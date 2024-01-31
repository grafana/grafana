package sql

import (
	"database/sql"
	"fmt"
	"math/big"
	"reflect"
	"regexp"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

type Converter struct {
	convert    func(interface{}, sql.ColumnType) (interface{}, error)
	fieldType  data.FieldType
	matchRegex *regexp.Regexp
	scanType   reflect.Type
}

var matchRegexes = map[string]*regexp.Regexp{
	"HUGEINT": regexp.MustCompile(`^HUGEINT`),
}

var Converters = map[string]Converter{
	"HUGEINT": {
		convert:    bigIntConvert,
		fieldType:  data.FieldTypeFloat64,
		matchRegex: matchRegexes["HUGEINT"],
		scanType:   reflect.PtrTo(reflect.PtrTo(reflect.TypeOf(big.NewInt(0)))),
	},
}

var DuckConverters = DuckDBConverters()

func DuckDBConverters() []sqlutil.Converter {
	var list []sqlutil.Converter
	for name, converter := range Converters {
		list = append(list, createConverter(name, converter))
	}
	return list
}

func GetConverter(columnType string) sqlutil.Converter {
	converter, ok := Converters[columnType]
	if ok {
		return createConverter(columnType, converter)
	}
	for name, converter := range Converters {
		if name == columnType {
			return createConverter(name, converter)
		}
		if converter.matchRegex != nil && converter.matchRegex.MatchString(columnType) {
			return createConverter(name, converter)
		}
	}
	return sqlutil.Converter{}
}

func createConverter(name string, converter Converter) sqlutil.Converter {
	convert := defaultConvert
	if converter.convert != nil {
		convert = converter.convert
	}
	return sqlutil.Converter{
		Name:           name,
		InputScanType:  converter.scanType,
		InputTypeRegex: converter.matchRegex,
		InputTypeName:  name,
		FrameConverter: sqlutil.FrameConverter{
			FieldType:         converter.fieldType,
			ConvertWithColumn: convert,
		},
	}
}

func defaultConvert(in interface{}, _ sql.ColumnType) (interface{}, error) {
	if in == nil {
		return reflect.Zero(reflect.TypeOf(in)).Interface(), nil
	}
	return reflect.ValueOf(in).Elem().Interface(), nil
}

func bigIntConvert(in interface{}, col sql.ColumnType) (interface{}, error) {
	if in == nil {
		return (*float64)(nil), nil
	}
	v, ok := in.(***big.Int)
	if !ok {
		return nil, fmt.Errorf("invalid big int - %v", in)
	}
	if *v == nil || **v == nil {
		return (*float64)(nil), nil
	}
	f, _ := new(big.Float).SetInt(**v).Float64()
	nullable, ok := col.Nullable()
	if !ok || !nullable {
		return f, nil
	}
	return &f, nil
}
