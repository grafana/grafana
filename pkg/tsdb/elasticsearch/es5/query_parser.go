package es5

import (
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"github.com/pkg/errors"
	"gopkg.in/olivere/elastic.v5"
)

const (
	epochMillis = "epoch_millis"
)

var InstanceESQueryParser = &ESQueryParser{}

type ESQueryParser struct{}

func (parser *ESQueryParser) SearchRequest(timeRange *tsdb.TimeRange, model *simplejson.Json, dsInfo *models.ESDataSource) (sr *elastic.SearchRequest, err error) {
	// Filter
	start := strconv.FormatInt(timeRange.GetFromAsMsEpoch(), 10)
	end := strconv.FormatInt(timeRange.GetToAsMsEpoch(), 10)
	timeFilter := elastic.NewRangeQuery(dsInfo.TimeField).Gte(start).Lte(end).Format(epochMillis)
	qs := model.Get("query").MustString("*")
	queryFilter := elastic.NewQueryStringQuery(qs)

	// Metrics
	metrics, err := model.Get(models.MetricKey).Array()
	if err != nil {
		return
	}
	metricAggs := map[string]elastic.Aggregation{}
	for _, a := range metrics {
		metric := simplejson.NewFromAny(a)
		id, err := metric.Get(models.IdKey).String()
		if err != nil {
			continue
		}
		agg, err := parseMetric(metric)
		if err != nil {
			continue
		}
		if agg != nil {
			metricAggs[id] = agg
		}
	}

	// Aggregation
	bucketAggs := model.Get(models.BucketAggsKey)
	aggId, agg := parseAgg(timeRange, bucketAggs, metricAggs)

	src := elastic.NewSearchSource().Size(0).Query(elastic.NewBoolQuery().Must(timeFilter, queryFilter)).Aggregation(aggId, agg)
	sr = elastic.NewSearchRequest().SearchTypeQueryThenFetch().SearchSource(src)

	return
}

func parseAgg(timeRange *tsdb.TimeRange, bucketAggs *simplejson.Json, metricAggs map[string]elastic.Aggregation) (aggId string, aggregation elastic.Aggregation) {
	baggs, err := bucketAggs.Array()
	if err != nil {
		return "", nil
	}
	start := strconv.FormatInt(timeRange.GetFromAsMsEpoch(), 10)
	end := strconv.FormatInt(timeRange.GetToAsMsEpoch(), 10)

	var subAggregation map[string]elastic.Aggregation = metricAggs
	size := len(baggs)
	for i := 0; i < size; i++ {
		bagg := simplejson.NewFromAny(baggs[size-i-1])
		t, err := bagg.Get(models.TypeKey).String()
		if err != nil {
			continue
		}
		aggId, err = bagg.Get(models.IdKey).String()
		if err != nil {
			continue
		}
		switch t {
		case models.AggTypeTerms:
			currAgg := wrapTermsAgg(bagg, subAggregation)
			subAggregation = replaceSubAggregation(aggId, currAgg, subAggregation)
		case models.AggTypeFilters:
			currAgg := wrapFiltersAgg(bagg, subAggregation)
			subAggregation = replaceSubAggregation(aggId, currAgg, subAggregation)
		case models.AggTypeHistogram:
			currAgg := wrapHistogramAgg(bagg, subAggregation)
			subAggregation = replaceSubAggregation(aggId, currAgg, subAggregation)
		case models.AggTypeGeoHashGrid:
			currAgg := wrapGeoHashGridAgg(bagg, subAggregation)
			subAggregation = replaceSubAggregation(aggId, currAgg, subAggregation)
		case models.AggTypeDateHistogram:
			currAgg := wrapDateHistogramAgg(bagg, subAggregation, start, end)
			subAggregation = replaceSubAggregation(aggId, currAgg, subAggregation)
		default:
			continue
		}
	}
	return aggId, subAggregation[aggId]
}

func replaceSubAggregation(aggId string, agg elastic.Aggregation, oldSubAggregation map[string]elastic.Aggregation) (newSubAggregation map[string]elastic.Aggregation) {
	newSubAggregation = map[string]elastic.Aggregation{}
	if agg != nil {
		newSubAggregation[aggId] = agg
		return
	}
	return oldSubAggregation
}

func wrapGeoHashGridAgg(bagg *simplejson.Json, lastAgg map[string]elastic.Aggregation) *elastic.GeoHashGridAggregation {
	field, err := bagg.Get(models.FieldKey).String()
	if err != nil {
		return nil
	}
	interval := bagg.Get(models.SettingsKey).Get(models.PrecisionKey).MustInt(models.ESDefaultGeoHashGridPrecision)

	currAggregation := elastic.NewGeoHashGridAggregation().Field(field).Precision(interval)
	for aggId, agg := range lastAgg {
		currAggregation = currAggregation.SubAggregation(aggId, agg)
	}
	return currAggregation
}

func wrapHistogramAgg(bagg *simplejson.Json, lastAgg map[string]elastic.Aggregation) *elastic.HistogramAggregation {
	field, err := bagg.Get(models.FieldKey).String()
	if err != nil {
		return nil
	}
	interval := bagg.Get(models.SettingsKey).Get(models.IntervalKey).MustFloat64(models.ESDefaultHistogramInterval)
	minDocCount := bagg.Get(models.SettingsKey).Get(models.MinDocCountKey).MustInt64()

	currAggregation := elastic.NewHistogramAggregation().MinDocCount(minDocCount).Field(field).Interval(interval)
	for aggId, agg := range lastAgg {
		currAggregation = currAggregation.SubAggregation(aggId, agg)
	}
	return currAggregation
}

func wrapFiltersAgg(bagg *simplejson.Json, lastAgg map[string]elastic.Aggregation) *elastic.FiltersAggregation {
	fs, err := bagg.Get(models.SettingsKey).Get(models.FiltersKey).Array()
	if err != nil {
		return nil
	}
	currAggregation := elastic.NewFiltersAggregation()
	for _, f := range fs {
		fJson := simplejson.NewFromAny(f)
		qs, err := fJson.Get(models.QueryKey).String()
		if err != nil {
			continue
		}
		label, _ := fJson.Get(models.LabelKey).String()
		if len(label) <= 0 {
			label = qs
		}
		query := elastic.NewQueryStringQuery(qs)
		currAggregation = currAggregation.FilterWithName(label, query)
	}
	for aggId, agg := range lastAgg {
		currAggregation = currAggregation.SubAggregation(aggId, agg)
	}
	return currAggregation

}

func wrapTermsAgg(bagg *simplejson.Json, lastAgg map[string]elastic.Aggregation) *elastic.TermsAggregation {
	field, err := bagg.Get(models.FieldKey).String()
	if err != nil {
		return nil
	}
	minDocCount := bagg.Get(models.SettingsKey).Get(models.MinDocCountKey).MustInt()

	currAggregation := elastic.NewTermsAggregation().MinDocCount(minDocCount).Field(field)
	for aggId, agg := range lastAgg {
		currAggregation = currAggregation.SubAggregation(aggId, agg)
	}
	return currAggregation
}

func wrapDateHistogramAgg(bagg *simplejson.Json, lastAgg map[string]elastic.Aggregation, start, end string) *elastic.DateHistogramAggregation {
	field, err := bagg.Get(models.FieldKey).String()
	if err != nil {
		return nil
	}
	interval := bagg.Get(models.SettingsKey).Get(models.IntervalKey).MustString(models.ESDefaultTimeInterval)
	if interval == models.AutoInterval {
		interval = models.ESDefaultTimeInterval
	}
	minDocCount := bagg.Get(models.SettingsKey).Get(models.MinDocCountKey).MustInt64()

	currAggregation := elastic.NewDateHistogramAggregation().MinDocCount(minDocCount).Field(field).Interval(interval).
		ExtendedBounds(start, end).Format(epochMillis)
	for aggId, agg := range lastAgg {
		currAggregation = currAggregation.SubAggregation(aggId, agg)
	}
	return currAggregation
}

func parseMetric(metric *simplejson.Json) (elastic.Aggregation, error) {
	t, err := metric.Get(models.TypeKey).String()
	if err != nil {
		return nil, err
	}
	parser := GetMetricParser(t)
	if parser == nil {
		return nil, errors.New(t + " has not been implemented yet")
	}
	return parser.Parse(metric)
}

func GetMetricParser(t string) MetricParser {
	switch t {
	case models.MetricTypeCount:
		return instanceCountMetricParser
	case models.MetricTypeAvg:
		return instanceAvgMetricParser
	case models.MetricTypeSum:
		return instanceSumMetricParser
	case models.MetricTypeMax:
		return instanceMaxMetricParser
	case models.MetricTypeMin:
		return instanceMinMetricParser
	case models.MetricTypeExtendedStats:
		return instanceStatsMetricParser
	case models.MetricTypePercentiles:
		return instancePercentileMetricParser
	case models.MetricTypeCardinality:
		return instanceCardinalityMetricParser
	case models.MetricTypeMovAvg:
		return instanceMovingAvgMetricParser
	case models.MetricTypeDerivative:
		return instanceDerivativeMetricParser
	default:
		return nil
	}
}

type MetricParser interface {
	Parse(metric *simplejson.Json) (elastic.Aggregation, error)
}

type countMetricParser struct{}
type avgMetricParser struct{}
type sumMetricParser struct{}
type maxMetricParser struct{}
type minMetricParser struct{}
type statsMetricParser struct{}
type percentileMetricParser struct{}
type cardinalityMetricParser struct{}
type movingAvgMetricParser struct{}
type derivativeMetricParser struct{}

var (
	instanceCountMetricParser       = &countMetricParser{}
	instanceAvgMetricParser         = &avgMetricParser{}
	instanceSumMetricParser         = &sumMetricParser{}
	instanceMaxMetricParser         = &maxMetricParser{}
	instanceMinMetricParser         = &minMetricParser{}
	instanceStatsMetricParser       = &statsMetricParser{}
	instancePercentileMetricParser  = &percentileMetricParser{}
	instanceCardinalityMetricParser = &cardinalityMetricParser{}
	instanceMovingAvgMetricParser   = &movingAvgMetricParser{}
	instanceDerivativeMetricParser  = &derivativeMetricParser{}
)

func (parser *countMetricParser) Parse(metric *simplejson.Json) (agg elastic.Aggregation, err error) {
	return
}

func (parser *avgMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewAvgAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()

	return agg, nil
}

func (parser *sumMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewSumAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()

	return agg, nil
}

func (parser *maxMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewMaxAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *minMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewMinAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *statsMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewExtendedStatsAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with sigma for now
	// sigma, err := metric.Get(models.SettingsKey).Get("sigma").String()
	// cannot deal with missing for now
	// m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *percentileMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewPercentilesAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	percents, err := metric.Get(models.SettingsKey).Get("percents").Array()
	percentiles := []float64{}
	for _, p := range percents {
		var percent float64
		switch ptype := p.(type) {
		case string:
			percent, err = strconv.ParseFloat(ptype, 10)
		default:
			percent, err = simplejson.NewFromAny(ptype).Float64()
		}
		if err != nil {
			continue
		}
		percentiles = append(percentiles, percent)
	}
	if len(percentiles) > 0 {
		agg = agg.Percentiles(percentiles...)
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *cardinalityMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewCardinalityAggregation().Field(field)
	script, err := metric.Get("inlineScript").String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	pt, err := metric.Get(models.SettingsKey).Get("precision_threshold").Int64()
	if err == nil {
		agg = agg.PrecisionThreshold(pt)
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

const (
	movAvgSimpleModelType      = "simple"
	movAvgLinearModelType      = "linear"
	movAvgEWMAModelType        = "ewma"
	movAvgHoltModelType        = "holt"
	movAvgHoltWintersModelType = "holt_winters"
)

func (parser *movingAvgMetricParser) Parse(metric *simplejson.Json) (ret elastic.Aggregation, err error) {
	bucketsPath, err := metric.Get("field").String()
	if err != nil {
		return nil, err
	}
	settings := metric.Get(models.SettingsKey)
	modelType, err := settings.Get("model").String()
	var model elastic.MovAvgModel
	if err != nil {
		return nil, err
	}
	switch modelType {
	case movAvgSimpleModelType:
		model = movAvgSimpleModel(settings)
	case movAvgLinearModelType:
		model = movAvgLinearModel(settings)
	case movAvgEWMAModelType:
		model = movAvgEWMAModel(settings)
	case movAvgHoltModelType:
		model = movAvgHoltModel(settings)
	case movAvgHoltWintersModelType:
		model = movAvgHoltWintersModel(settings)
	default:
		return nil, errors.New(modelType + " is not implemented")
	}
	agg := elastic.NewMovAvgAggregation().Model(model).BucketsPath(bucketsPath)
	if window, err := settings.Get("window").Int(); err == nil {
		agg.Window(window)
	}
	if predict, err := settings.Get("predict").Int(); err == nil {
		agg.Predict(predict)
	}
	if minimize, err := settings.Get("minimize").Bool(); err == nil {
		agg.Minimize(minimize)
	}
	return agg, nil
}

func movAvgSimpleModel(settings *simplejson.Json) elastic.MovAvgModel {
	return elastic.NewSimpleMovAvgModel()
}

func movAvgLinearModel(settings *simplejson.Json) elastic.MovAvgModel {
	return elastic.NewLinearMovAvgModel()
}

func movAvgEWMAModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewEWMAMovAvgModel()
	val, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(val)
	}
	return model
}

func movAvgHoltModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewHoltLinearMovAvgModel()
	alpha, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(alpha)
	}
	beta, err := settings.Get(models.SettingsKey).Get(models.BetaKey).Float64()
	if err == nil {
		model.Beta(beta)
	}
	return model
}

func movAvgHoltWintersModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewHoltWintersMovAvgModel()
	alpha, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(alpha)
	}
	beta, err := settings.Get(models.SettingsKey).Get(models.BetaKey).Float64()
	if err == nil {
		model.Beta(beta)
	}
	gamma, err := settings.Get(models.SettingsKey).Get(models.GammaKey).Float64()
	if err == nil {
		model.Gamma(gamma)
	}
	period, err := settings.Get(models.SettingsKey).Get("period").Int()
	if err == nil {
		model.Period(period)
	}
	pad, err := settings.Get(models.SettingsKey).Get("pad").Bool()
	if err == nil {
		model.Pad(pad)
	}
	return model
}

func (parser *derivativeMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewDerivativeAggregation().BucketsPath(field)
	unit, err := metric.Get(models.SettingsKey).Get(models.UnitKey).String()
	if len(unit) > 0 {
		agg = agg.Unit(unit)
	}
	return agg, nil
}
