package testdatasource

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func (s *Service) handleCsvContentScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		model, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		csvContent := model.Get("csvContent").MustString()
		if len(csvContent) == 0 {
			return backend.NewQueryDataResponse(), nil
		}

		alias := model.Get("alias").MustString("")

		frame, err := LoadCsvContent(strings.NewReader(csvContent), alias)
		if err != nil {
			return nil, err
		}

		dropPercent := model.Get("dropPercent").MustFloat64(0)
		if dropPercent > 0 {
			frame, err = dropValues(frame, dropPercent)
			if err != nil {
				return nil, err
			}
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) handleCsvFileScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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

		frame, err := s.loadCsvFile(fileName)

		if err != nil {
			return nil, err
		}

		dropPercent := model.Get("dropPercent").MustFloat64(0)
		if dropPercent > 0 {
			frame, err = dropValues(frame, dropPercent)
			if err != nil {
				return nil, err
			}
		}

		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (s *Service) loadCsvFile(fileName string) (*data.Frame, error) {
	validFileName := regexp.MustCompile(`^\w+\.csv$`)

	if !validFileName.MatchString(fileName) {
		return nil, fmt.Errorf("invalid csv file name: %q", fileName)
	}

	csvFilepath := filepath.Clean(filepath.Join("/", fileName))
	filePath := filepath.Join(s.cfg.StaticRootPath, "testdata", csvFilepath)

	// Can ignore gosec G304 here, because we check the file pattern above
	// nolint:gosec
	fileReader, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed open file: %v", err)
	}

	defer func() {
		if err := fileReader.Close(); err != nil {
			s.logger.Warn("Failed to close file", "err", err, "path", fileName)
		}
	}()

	return LoadCsvContent(fileReader, fileName)
}

// LoadCsvContent should be moved to the SDK
func LoadCsvContent(ioReader io.Reader, name string) (*data.Frame, error) {
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
		if errors.Is(err, io.EOF) {
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
			// Check if the values are actually a time field
			if strings.Contains(strings.ToLower(fieldName), "time") {
				timeField := toTimeField(field)
				if timeField != nil {
					field = timeField
				}
			}

			// Check for labels in the name
			idx := strings.Index(fieldName, "{")
			if idx >= 0 {
				labels := parseLabelsString(fieldName[idx:], fieldIndex) // _ := data.LabelsFromString(fieldName[idx:])
				if len(labels) > 0 {
					field.Labels = labels
					fieldName = fieldName[:idx]
				}
			}

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

	// Try parsing values as numbers
	ok := false
	field := data.NewFieldFromFieldType(data.FieldTypeNullableInt64, len(parts))
	for idx, strVal := range parts {
		if strVal == "null" || strVal == "" {
			continue
		}

		val, err := strconv.ParseInt(strVal, 10, 64)
		if err != nil {
			ok = false
			break
		}
		field.SetConcrete(idx, val)
		ok = true
	}
	if ok {
		return field, nil
	}

	// Maybe floats
	field = data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(parts))
	for idx, strVal := range parts {
		if strVal == "null" || strVal == "" {
			continue
		}

		val, err := strconv.ParseFloat(strVal, 64)
		if err != nil {
			ok = false
			break
		}
		field.SetConcrete(idx, val)
		ok = true
	}
	if ok {
		return field, nil
	}

	// Replace empty strings with null
	field = data.NewFieldFromFieldType(data.FieldTypeNullableString, len(parts))
	for idx, strVal := range parts {
		if strVal == "null" || strVal == "" {
			continue
		}
		field.SetConcrete(idx, strVal)
	}
	return field, nil
}

// This will try to convert the values to a timestamp
func toTimeField(field *data.Field) *data.Field {
	found := false
	count := field.Len()
	timeField := data.NewFieldFromFieldType(data.FieldTypeNullableTime, count)
	timeField.Config = field.Config
	timeField.Name = field.Name
	timeField.Labels = field.Labels
	ft := field.Type()
	if ft.Numeric() {
		for i := 0; i < count; i++ {
			v, err := field.FloatAt(i)
			if err == nil {
				t := time.Unix(0, int64(v)*int64(time.Millisecond))
				timeField.SetConcrete(i, t.UTC())
				found = true
			}
		}
		if !found {
			return nil
		}
		return timeField
	}
	if ft == data.FieldTypeNullableString || ft == data.FieldTypeString {
		for i := 0; i < count; i++ {
			v, ok := field.ConcreteAt(i)
			if ok && v != nil {
				t, err := time.Parse(time.RFC3339, v.(string))
				if err == nil {
					timeField.SetConcrete(i, t.UTC())
					found = true
				}
			}
		}
		if !found {
			return nil
		}
		return timeField
	}
	return nil
}
