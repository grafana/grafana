package testdatasource

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func (p *testDataPlugin) handleCsvContentScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		csvContent := model.Get("csvContent").MustString()
		alias := model.Get("alias").MustString(q.RefID)

		frame, err := p.loadCsvContent(strings.NewReader(csvContent), alias)
		if err != nil {
			return nil, err
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil

}

func (p *testDataPlugin) handleCsvFileScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json %v", err)
		}

		fileName := model.Get("csvFileName").MustString()

		if len(fileName) == 0 {
			continue
		}

		frame, err := p.loadCsvFile(fileName)

		if err != nil {
			return nil, err
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) loadCsvFile(fileName string) (*data.Frame, error) {
	validFileName := regexp.MustCompile(`([\w_]+)\.csv`)

	if !validFileName.MatchString(fileName) {
		return nil, fmt.Errorf("invalid csv file name: %q", fileName)
	}

	filePath := filepath.Join(p.Cfg.StaticRootPath, "testdata", fileName)
	fileReader, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed open file: %v", err)
	}

	defer fileReader.Close()

	return p.loadCsvContent(fileReader, fileName)
}

func (p *testDataPlugin) loadCsvContent(ioReader io.Reader, name string) (*data.Frame, error) {
	reader := csv.NewReader(ioReader)

	// Read the header records
	headerFields, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read header line: %v", err)
	}

	fields := []*data.Field{}
	fieldNames := []string{}
	fieldRawValues := [][]string{}

	for _, fieldName := range headerFields {
		fieldNames = append(fieldNames, strings.Trim(fieldName, " "))
		fieldRawValues = append(fieldRawValues, []string{})
	}

	for {
		lineValues, err := reader.Read()
		if err == io.EOF {
			break // reached end of the file
		} else if err != nil {
			return nil, fmt.Errorf("failed to read line: %v", err)
		}

		for fieldIndex, value := range lineValues {
			fieldRawValues[fieldIndex] = append(fieldRawValues[fieldIndex], strings.Trim(value, " "))
		}
	}

	longest := 0
	for fieldIndex, rawValues := range fieldRawValues {
		fieldName := fieldNames[fieldIndex]
		field, err := csvValuesToField(rawValues)
		if err == nil {
			field.Name = fieldName
			fields = append(fields, field)
			if field.Len() > longest {
				longest = field.Len()
			}
		}
	}

	// Make all fields the same length
	for _, field := range fields {
		delta := field.Len() - longest
		if delta > 0 {
			field.Extend(delta)
		}
	}

	frame := data.NewFrame(name, fields...)
	return frame, nil
}

func csvLineToField(stringInput string) (*data.Field, error) {
	return csvValuesToField(strings.Split(strings.ReplaceAll(stringInput, " ", ""), ","))
}

func csvValuesToField(parts []string) (*data.Field, error) {
	if len(parts) < 1 {
		return nil, fmt.Errorf("csv must have at least one value")
	}

	first := strings.ToUpper(parts[0])
	if first == "T" || first == "F" || first == "TRUE" || first == "FALSE" {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableBool, len(parts))
		for idx, strVal := range parts {
			strVal = strings.ToUpper(strVal)
			if strVal == "NULL" || strVal == "" {
				continue
			}
			field.SetConcrete(idx, strVal == "T" || strVal == "TRUE")
		}
		return field, nil
	}

	// If we can not parse the first value as a number, assume strings
	_, err := strconv.ParseFloat(first, 64)
	if err != nil {
		field := data.NewFieldFromFieldType(data.FieldTypeNullableString, len(parts))
		for idx, strVal := range parts {
			if strVal == "null" || strVal == "" {
				continue
			}
			field.SetConcrete(idx, strVal)
		}
		return field, nil
	}

	// Set any valid numbers
	field := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(parts))
	for idx, strVal := range parts {
		if val, err := strconv.ParseFloat(strVal, 64); err == nil {
			field.SetConcrete(idx, val)
		}
	}
	return field, nil
}
