package sql

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/olekukonko/tablewriter"
)

const header = "5 row sample:"

func TextToSQL(text string, frames data.Frames) (string, error) {
	schema := getSchema(frames, 1)
	return Translate(text, schema)
}

// should look like this https://github.com/scottlepp/ducker/blob/main/schema.txt
func getSchema(frames data.Frames, rowLimit int) string {
	result := []string{}

	for _, f := range frames {
		name := f.RefID
		if name == "" {
			name = f.Name
		}
		fields := getFields(f)
		schema := strings.Join(fields, ", ")
		result = append(result, schema)
		result = append(result, header)
		result = append(result, getData(f, rowLimit))
	}

	return strings.Join(result, "\n")
}

func getFields(f *data.Frame) []string {
	fields := []string{}
	for _, fld := range f.Fields {
		var field = getField(fld)
		fields = append(fields, fmt.Sprintf("%s(%s)", field.name, field.kind))
	}
	return fields
}

func getField(fld *data.Field) Field {
	if fld.Type() == data.FieldTypeBool || fld.Type() == data.FieldTypeNullableBool {
		return Field{name: fld.Name, kind: "BOOLEAN", align: tablewriter.ALIGN_LEFT}
	}
	if fld.Type() == data.FieldTypeFloat32 || fld.Type() == data.FieldTypeFloat64 || fld.Type() == data.FieldTypeNullableFloat32 || fld.Type() == data.FieldTypeNullableFloat64 {
		return Field{name: fld.Name, kind: "DOUBLE", align: tablewriter.ALIGN_RIGHT}
	}
	if fld.Type() == data.FieldTypeInt8 || fld.Type() == data.FieldTypeInt16 || fld.Type() == data.FieldTypeInt32 || fld.Type() == data.FieldTypeNullableInt8 || fld.Type() == data.FieldTypeNullableInt16 || fld.Type() == data.FieldTypeNullableInt32 {
		return Field{name: fld.Name, kind: "INTEGER", align: tablewriter.ALIGN_RIGHT}
	}
	if fld.Type() == data.FieldTypeInt64 || fld.Type() == data.FieldTypeNullableInt64 {
		return Field{name: fld.Name, kind: "BIGINT", align: tablewriter.ALIGN_RIGHT}
	}
	if fld.Type() == data.FieldTypeUint8 || fld.Type() == data.FieldTypeUint16 || fld.Type() == data.FieldTypeUint32 || fld.Type() == data.FieldTypeNullableUint8 || fld.Type() == data.FieldTypeNullableUint16 || fld.Type() == data.FieldTypeNullableUint32 {
		return Field{name: fld.Name, kind: "UINTEGER", align: tablewriter.ALIGN_RIGHT}
	}
	if fld.Type() == data.FieldTypeUint64 || fld.Type() == data.FieldTypeNullableUint64 {
		return Field{name: fld.Name, kind: "UBIGINT", align: tablewriter.ALIGN_RIGHT}
	}
	if fld.Type() == data.FieldTypeString || fld.Type() == data.FieldTypeNullableString {
		return Field{name: fld.Name, kind: "VARCHAR", align: tablewriter.ALIGN_LEFT}
	}
	if fld.Type() == data.FieldTypeTime || fld.Type() == data.FieldTypeNullableTime {
		return Field{name: fld.Name, kind: "TIMESTAMP", align: tablewriter.ALIGN_LEFT}
	}
	if fld.Type() == data.FieldTypeUnknown {
		return Field{name: fld.Name, kind: "BLOB", align: tablewriter.ALIGN_LEFT}
	}
	return Field{}
}

type Field struct {
	name   string
	kind   string
	size   int
	number bool
	align  int
}

func getData(frame *data.Frame, limit int) string {
	v := stringTable(frame, limit)

	rows := strings.Split(v, "\n")

	formatted := []string{
		formatHeader(frame, rows[0]),
	}

	underline := formatUnderline(frame, rows[1])
	formatted = append(formatted, underline)

	for i := 2; i < len(rows); i++ {
		formatted = append(formatted, rows[i])
	}

	return strings.Join(formatted, "\n")
}

func stringTable(f *data.Frame, rowLimit int) string {
	sb := &strings.Builder{}
	table := tablewriter.NewWriter(sb)
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetAutoWrapText(false)
	table.SetColumnAlignment(alignment(f))
	table.SetAutoFormatHeaders(false)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)

	headers := make([]string, len(f.Fields))
	for colIdx, field := range f.Fields {
		headers[colIdx] = field.Name
	}
	table.SetHeader(headers)

	for rowIdx := 0; rowIdx < rowLimit; rowIdx++ {
		iRow := f.RowCopy(rowIdx)             // interface row (source)
		sRow := make([]string, len(f.Fields)) // string row (destination)

		for colIdx, v := range iRow {
			val := reflect.Indirect(reflect.ValueOf(v))
			if !val.IsValid() {
				sRow[colIdx] = "null"
				continue
			}

			switch {
			case f.Fields[colIdx].Type() == data.FieldTypeJSON:
				sRow[colIdx] = string(v.(json.RawMessage))
			case f.Fields[colIdx].Type() == data.FieldTypeNullableJSON:
				sRow[colIdx] = string(*v.(*json.RawMessage))
			default:
				sRow[colIdx] = fmt.Sprintf("%v", val)
			}
		}
		table.Append(sRow)
	}

	table.Render()
	return sb.String()
}

func alignment(f *data.Frame) []int {
	res := []int{}
	for _, fld := range f.Fields {
		var field = getField(fld)
		res = append(res, field.align)
	}
	return res
}

func replaceAtIndex(in string, r rune, i int) string {
	out := []rune(in)
	out[i] = r
	return string(out)
}

func formatUnderline(frame *data.Frame, row string) string {
	underline := row
	cols := strings.Split(underline, "+")
	validCols := []string{}
	for _, col := range cols {
		if col != "" {
			validCols = append(validCols, col)
		}
	}

	newCols := []string{}
	for idx, fld := range frame.Fields {
		var field = getField(fld)
		col := validCols[idx]
		if field.align == tablewriter.ALIGN_LEFT {
			col = strings.Replace(col, "-", ":", 1)
		} else {
			col = replaceAtIndex(col, ':', len(col)-1)
		}
		newCols = append(newCols, col)
	}

	line := strings.Join(newCols, "|")
	line = "|" + line + "|"
	return line
}

func formatHeader(frame *data.Frame, header string) string {
	cols := strings.Split(header, "|")
	validCols := []string{}
	for _, col := range cols {
		if col != "" {
			validCols = append(validCols, col)
		}
	}

	newCols := []string{}
	for idx, fld := range frame.Fields {
		var field = getField(fld)
		col := validCols[idx]
		if field.align == tablewriter.ALIGN_RIGHT {
			clen := len(col)
			val := strings.TrimSpace(col)
			vlen := len(val)
			pad := clen - vlen - 1
			col = fmt.Sprintf("%s%s%s", strings.Repeat(" ", pad), val, " ")
		}
		newCols = append(newCols, col)
	}

	line := strings.Join(newCols, "|")
	line = "|" + line + "|"
	return line
}
