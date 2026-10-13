package expr

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	SQLMetricFieldName  = "__metric_name__"
	SQLValueFieldName   = "__value__"
	SQLDisplayFieldName = "__display_name__"

	// These are not types in the SDK or dataplane contract yet.
	numericFullLongType    = "numeric-full-long"
	timeseriesFullLongType = "timeseries-full-long"
)

func ConvertToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) == 0 {
		return frames, nil
	}

	var inputType data.FrameType
	if frames[0].Meta != nil && frames[0].Meta.Type != "" {
		inputType = frames[0].Meta.Type
	} else {
		// shouldn't hit this when calling from handleSqlInput as supportedToLongConversion is called first
		return nil, fmt.Errorf("input frame missing FrameMeta.Type")
	}

	// Prometheus "Both" queries mix instant (numeric-multi) and range (timeseries-multi)
	// frames in any order. Only the time-series converter keeps the rows of both.
	if inputType == data.FrameTypeNumericMulti && hasFrameType(frames, data.FrameTypeTimeSeriesMulti) {
		inputType = data.FrameTypeTimeSeriesMulti
	}

	switch inputType {
	case data.FrameTypeNumericMulti:
		return convertNumericMultiToFullLong(frames)
	case data.FrameTypeNumericWide:
		return convertNumericWideToFullLong(frames)
	case data.FrameTypeTimeSeriesMulti:
		return convertTimeSeriesMultiToFullLong(frames)
	case data.FrameTypeTimeSeriesWide:
		return convertTimeSeriesWideToFullLong(frames)
	default:
		// Shouldn't hit this when calling from handleSqlInput as supportedToLongConversion is called first
		return nil, fmt.Errorf("unsupported input type %s for full long conversion", inputType)
	}
}

func convertNumericMultiToFullLong(frames data.Frames) (data.Frames, error) {
	wide := convertNumericMultiToNumericWide(frames)
	return convertNumericWideToFullLong(wide)
}

func convertNumericWideToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]
	// Check every field: Rows() reads only the first one, and fields merged from
	// numeric-multi frames can have different lengths.
	for _, field := range inputFrame.Fields {
		if field.Len() > 1 {
			return nil, fmt.Errorf("expected no more than one row in the frame, but field %q has %d rows", field.Name, field.Len())
		}
	}

	var (
		metricCol     = make([]string, 0, len(inputFrame.Fields))
		valueCol      = make([]*float64, 0, len(inputFrame.Fields))
		displayCol    = make([]*string, 0, len(inputFrame.Fields))
		hasDisplayCol bool
	)

	labelKeySet := map[string]struct{}{}
	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		val, err := field.FloatAt(0)
		if err != nil {
			continue
		}
		v := val
		valueCol = append(valueCol, &v)
		metricCol = append(metricCol, field.Name)

		// Display name
		var d *string
		if field.Config != nil && field.Config.DisplayNameFromDS != "" {
			s := field.Config.DisplayNameFromDS
			d = &s
			hasDisplayCol = true
		}
		displayCol = append(displayCol, d)

		for k := range field.Labels {
			labelKeySet[k] = struct{}{}
		}
	}

	labelKeys := make([]string, 0, len(labelKeySet))

	labelValues := make(map[string][]*string)
	for k := range labelKeySet {
		labelKeys = append(labelKeys, k)
		labelValues[k] = make([]*string, 0, len(valueCol))
	}
	sort.Strings(labelKeys)

	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		for _, k := range labelKeys {
			var val *string
			if field.Labels != nil {
				if v, ok := field.Labels[k]; ok {
					val = &v
				}
			}
			labelValues[k] = append(labelValues[k], val)
		}
	}

	fields := []*data.Field{
		data.NewField(SQLMetricFieldName, nil, metricCol),
		data.NewField(SQLValueFieldName, nil, valueCol),
	}
	if hasDisplayCol {
		fields = append(fields, data.NewField(SQLDisplayFieldName, nil, displayCol))
	}
	labelCols := labelColumnNames(labelKeys, fields)
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(labelCols[k], nil, labelValues[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: numericFullLongType}
	return data.Frames{out}, nil
}

func convertTimeSeriesMultiToFullLong(frames data.Frames) (data.Frames, error) {
	type row struct {
		t       time.Time
		value   *float64
		metric  string
		display *string
		labels  data.Labels
	}

	var rows []row
	labelKeysSet := map[string]struct{}{}
	hasDisplayCol := false
	auxCols := newAuxColumns()

	for _, frame := range frames {
		// Like the dataplane reader, skip frames of other types, such as untyped
		// exemplar frames, so they do not become metric rows. Keep numeric-multi
		// frames, which mix in from Prometheus "Both" queries.
		if frame.Meta == nil || (frame.Meta.Type != data.FrameTypeTimeSeriesMulti && frame.Meta.Type != data.FrameTypeNumericMulti) {
			continue
		}
		var timeField *data.Field
		for _, f := range frame.Fields {
			if f.Type() == data.FieldTypeTime {
				timeField = f
				break
			}
		}
		if timeField == nil {
			return nil, fmt.Errorf("missing time field")
		}
		var frameAux int32
		if aux := auxFieldsOf(frame.Fields, timeField); len(aux) > 0 {
			var err error
			if frameAux, err = auxCols.addSeries(aux); err != nil {
				return nil, err
			}
		}
		for _, f := range frame.Fields {
			if !f.Type().Numeric() {
				continue
			}
			var display *string
			if f.Config != nil && f.Config.DisplayNameFromDS != "" {
				s := f.Config.DisplayNameFromDS
				display = &s
				hasDisplayCol = true
			}
			for i := 0; i < f.Len(); i++ {
				t := timeField.At(i).(time.Time)
				v, err := f.FloatAt(i)
				if err != nil {
					continue
				}
				val := v
				rows = append(rows, row{
					t:       t,
					value:   &val,
					metric:  f.Name,
					display: display,
					labels:  f.Labels,
				})
				auxCols.addRow(len(rows)-1, frameAux, i)
				for k := range f.Labels {
					labelKeysSet[k] = struct{}{}
				}
			}
		}
	}

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)
	sortFullLongRows(rows, auxCols.rows, func(a, b *row) bool {
		if a.t.Equal(b.t) {
			return a.metric < b.metric
		}
		return a.t.Before(b.t)
	})

	times := make([]time.Time, len(rows))
	values := make([]*float64, len(rows))
	metrics := make([]string, len(rows))
	var displays []*string
	if hasDisplayCol {
		displays = make([]*string, len(rows))
	}
	labels := make(map[string][]*string)
	for _, k := range labelKeys {
		labels[k] = make([]*string, len(rows))
	}

	for i, r := range rows {
		times[i] = r.t
		values[i] = r.value
		metrics[i] = r.metric
		if hasDisplayCol {
			displays[i] = r.display
		}
		for _, k := range labelKeys {
			if v, ok := r.labels[k]; ok {
				labels[k][i] = &v
			}
		}
	}

	fields := []*data.Field{
		data.NewField("time", nil, times),
		data.NewField(SQLValueFieldName, nil, values),
		data.NewField(SQLMetricFieldName, nil, metrics),
	}
	if hasDisplayCol {
		fields = append(fields, data.NewField(SQLDisplayFieldName, nil, displays))
	}
	auxFields := auxCols.fields(fields, labelKeys, len(rows))
	auxCols.fill(auxFields)
	fields = append(fields, auxFields...)
	labelCols := labelColumnNames(labelKeys, fields)
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(labelCols[k], nil, labels[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: timeseriesFullLongType}
	return data.Frames{out}, nil
}

func convertTimeSeriesWideToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	frame := frames[0]

	var timeField *data.Field
	for _, f := range frame.Fields {
		if f.Type() == data.FieldTypeTime {
			timeField = f
			break
		}
	}
	if timeField == nil {
		return nil, fmt.Errorf("time field not found in TimeSeriesWide frame")
	}

	type row struct {
		t       time.Time
		value   *float64
		metric  string
		display *string
		labels  data.Labels
	}

	var (
		rows          []row
		labelKeysSet  = map[string]struct{}{}
		hasDisplayCol bool
		auxCols       = newAuxColumns()
	)

	// In wide frames, a non-numeric field belongs to the series with the same labels.
	var seriesAux map[string]int32
	if aux := auxFieldsOf(frame.Fields, timeField); len(aux) > 0 {
		bySeries := map[string][]*data.Field{}
		for _, f := range aux {
			key := f.Labels.String()
			bySeries[key] = append(bySeries[key], f)
		}
		// Register columns in the order of the value fields, so column order is stable.
		seriesAux = map[string]int32{}
		for _, f := range frame.Fields {
			if !f.Type().Numeric() {
				continue
			}
			key := f.Labels.String()
			if _, done := seriesAux[key]; done {
				continue
			}
			series, err := auxCols.addSeries(bySeries[key])
			if err != nil {
				return nil, err
			}
			seriesAux[key] = series
		}
	}

	// Collect all label keys
	for _, f := range frame.Fields {
		if !f.Type().Numeric() {
			continue
		}
		for k := range f.Labels {
			labelKeysSet[k] = struct{}{}
		}
	}

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)

	timeLen := timeField.Len()
	for _, f := range frame.Fields {
		if !f.Type().Numeric() {
			continue
		}
		var display *string
		if f.Config != nil && f.Config.DisplayNameFromDS != "" {
			s := f.Config.DisplayNameFromDS
			display = &s
			hasDisplayCol = true
		}
		var aux int32
		if seriesAux != nil {
			aux = seriesAux[f.Labels.String()]
		}
		for i := range timeLen {
			t := timeField.At(i).(time.Time)
			v, err := f.FloatAt(i)
			if err != nil {
				continue
			}
			val := v
			rows = append(rows, row{
				t:       t,
				value:   &val,
				metric:  f.Name,
				display: display,
				labels:  f.Labels,
			})
			auxCols.addRow(len(rows)-1, aux, i)
		}
	}

	sortFullLongRows(rows, auxCols.rows, func(a, b *row) bool {
		if a.t.Equal(b.t) {
			return a.metric < b.metric
		}
		return a.t.Before(b.t)
	})

	times := make([]time.Time, len(rows))
	values := make([]*float64, len(rows))
	metrics := make([]string, len(rows))
	var displays []*string
	if hasDisplayCol {
		displays = make([]*string, len(rows))
	}
	labels := make(map[string][]*string)
	for _, k := range labelKeys {
		labels[k] = make([]*string, len(rows))
	}

	for i, r := range rows {
		times[i] = r.t
		values[i] = r.value
		metrics[i] = r.metric
		if hasDisplayCol {
			displays[i] = r.display
		}
		for _, k := range labelKeys {
			if v, ok := r.labels[k]; ok {
				labels[k][i] = &v
			}
		}
	}

	fields := []*data.Field{
		data.NewField("time", nil, times),
		data.NewField(SQLValueFieldName, nil, values),
		data.NewField(SQLMetricFieldName, nil, metrics),
	}
	if hasDisplayCol {
		fields = append(fields, data.NewField(SQLDisplayFieldName, nil, displays))
	}
	auxFields := auxCols.fields(fields, labelKeys, len(rows))
	auxCols.fill(auxFields)
	fields = append(fields, auxFields...)
	labelCols := labelColumnNames(labelKeys, fields)
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(labelCols[k], nil, labels[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: timeseriesFullLongType}
	return data.Frames{out}, nil
}

// labelColumnNames maps each label key to the name of its column. A key that
// matches a generated column gets a "label_" prefix until the name is unique,
// so SQL can still reference both columns. The SQL engine compares column names
// without case, so the check does too. Other keys keep their name.
func labelColumnNames(labelKeys []string, generated []*data.Field) map[string]string {
	generatedNames := make(map[string]struct{}, len(generated))
	for _, f := range generated {
		generatedNames[strings.ToLower(f.Name)] = struct{}{}
	}
	taken := make(map[string]struct{}, len(generated)+len(labelKeys))
	for n := range generatedNames {
		taken[n] = struct{}{}
	}
	for _, k := range labelKeys {
		taken[strings.ToLower(k)] = struct{}{}
	}

	names := make(map[string]string, len(labelKeys))
	for _, k := range labelKeys {
		name := k
		if _, clash := generatedNames[strings.ToLower(k)]; clash {
			name = "label_" + k
			for {
				if _, ok := taken[strings.ToLower(name)]; !ok {
					break
				}
				name = "label_" + name
			}
			taken[strings.ToLower(name)] = struct{}{}
		}
		names[k] = name
	}
	return names
}

// auxColumns collects the non-numeric value fields of time series frames, such
// as a second time field. Each becomes one column that holds the value of the
// row's own series. Fields with the same name share a column, compared without
// case, since the SQL engine compares column names that way.
type auxColumns struct {
	cols   []auxColumn
	index  map[string]int
	series [][]auxRef
	// rows runs parallel to the converter's rows, and packs each row's series
	// (index plus one, 0 for none) and source index. It stays nil until a row
	// has aux fields, so numeric-only inputs do no extra work.
	rows []uint64
}

type auxColumn struct {
	name string
	typ  data.FieldType
}

type auxRef struct {
	col   int
	field *data.Field
}

func newAuxColumns() *auxColumns {
	return &auxColumns{index: map[string]int{}}
}

// auxFieldsOf returns the fields that become their own columns: non-numeric
// fields other than the time field.
func auxFieldsOf(fields []*data.Field, timeField *data.Field) []*data.Field {
	var out []*data.Field
	for _, f := range fields {
		if f == timeField || f.Type().Numeric() {
			continue
		}
		out = append(out, f)
	}
	return out
}

// addSeries registers the non-numeric fields of one series. It returns the
// series' index plus one, or 0 when the series has no such fields.
func (a *auxColumns) addSeries(fields []*data.Field) (int32, error) {
	if len(fields) == 0 {
		return 0, nil
	}
	var refs []auxRef
	seen := map[string]struct{}{}
	for _, f := range fields {
		key := strings.ToLower(f.Name)
		if _, dup := seen[key]; dup {
			return 0, fmt.Errorf("field %q appears more than once in one series", f.Name)
		}
		seen[key] = struct{}{}

		typ := f.Type().NullableType()
		col, ok := a.index[key]
		if !ok {
			col = len(a.cols)
			a.index[key] = col
			a.cols = append(a.cols, auxColumn{name: f.Name, typ: typ})
		} else if a.cols[col].typ != typ {
			return 0, fmt.Errorf("field %q has type %s in one series and %s in another", f.Name, a.cols[col].typ, typ)
		}
		refs = append(refs, auxRef{col: col, field: f})
	}
	a.series = append(a.series, refs)
	return int32(len(a.series)), nil
}

func (a *auxColumns) addRow(rowIdx int, series int32, srcIdx int) {
	if a.rows == nil {
		if series == 0 {
			return
		}
		a.rows = make([]uint64, rowIdx, rowIdx+1)
	}
	a.rows = append(a.rows, uint64(series)<<32|uint64(uint32(srcIdx)))
}

// fill sets each row's aux values in the fields from auxColumns.fields.
func (a *auxColumns) fill(out []*data.Field) {
	for i, packed := range a.rows {
		series := packed >> 32
		if series == 0 {
			continue
		}
		srcIdx := int(uint32(packed))
		for _, ref := range a.series[series-1] {
			if srcIdx >= ref.field.Len() {
				continue
			}
			if v, ok := ref.field.ConcreteAt(srcIdx); ok {
				out[ref.col].SetConcrete(i, v)
			}
		}
	}
}

// sortFullLongRows sorts rows stably, and keeps aux, when set, in step with them.
func sortFullLongRows[R any](rows []R, aux []uint64, less func(a, b *R) bool) {
	if aux == nil {
		sort.SliceStable(rows, func(i, j int) bool { return less(&rows[i], &rows[j]) })
		return
	}
	sort.Stable(rowsWithAux[R]{rows: rows, aux: aux, less: less})
}

type rowsWithAux[R any] struct {
	rows []R
	aux  []uint64
	less func(a, b *R) bool
}

func (r rowsWithAux[R]) Len() int           { return len(r.rows) }
func (r rowsWithAux[R]) Less(i, j int) bool { return r.less(&r.rows[i], &r.rows[j]) }
func (r rowsWithAux[R]) Swap(i, j int) {
	r.rows[i], r.rows[j] = r.rows[j], r.rows[i]
	r.aux[i], r.aux[j] = r.aux[j], r.aux[i]
}

// fields returns one empty nullable field per column. A name that matches a
// generated column or a label key gets a "field_" prefix until it is unique, so
// columns that convert today keep their names.
func (a *auxColumns) fields(generated []*data.Field, labelKeys []string, n int) []*data.Field {
	if len(a.cols) == 0 {
		return nil
	}
	taken := make(map[string]struct{}, len(generated)+len(labelKeys)+len(a.cols))
	for _, f := range generated {
		taken[strings.ToLower(f.Name)] = struct{}{}
	}
	for _, k := range labelKeys {
		taken[strings.ToLower(k)] = struct{}{}
	}
	out := make([]*data.Field, 0, len(a.cols))
	for _, c := range a.cols {
		name := c.name
		for {
			if _, ok := taken[strings.ToLower(name)]; !ok {
				break
			}
			name = "field_" + name
		}
		taken[strings.ToLower(name)] = struct{}{}
		f := data.NewFieldFromFieldType(c.typ, n)
		f.Name = name
		out = append(out, f)
	}
	return out
}

func hasFrameType(frames data.Frames, t data.FrameType) bool {
	for _, f := range frames {
		if f.Meta != nil && f.Meta.Type == t {
			return true
		}
	}
	return false
}

func supportedToLongConversion(inputType data.FrameType) bool {
	switch inputType {
	case data.FrameTypeNumericMulti, data.FrameTypeNumericWide:
		return true
	case data.FrameTypeTimeSeriesMulti, data.FrameTypeTimeSeriesWide:
		return true
	default:
		return false
	}
}

func convertNumericMultiToNumericWide(frames data.Frames) data.Frames {
	if len(frames) == 0 {
		return nil
	}

	out := data.NewFrame("")
	for _, frame := range frames {
		for _, field := range frame.Fields {
			if field.Type().Numeric() {
				out.Fields = append(out.Fields, field)
			}
		}
	}
	out.Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}
	return data.Frames{out}
}
