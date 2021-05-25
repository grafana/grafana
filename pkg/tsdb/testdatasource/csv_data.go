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
	fileReader, err := os.Open(filepath.Clean(filePath))
	if err != nil {
		return nil, fmt.Errorf("failed open file: %v", err)
	}

	defer func() {
		err = fileReader.Close()
		if err != nil {
			p.logger.Error("Failed to close file", "error", err)
		}
	}()

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
		if errors.Is(err, io.EOF) {
			break // reached end of the file
		} else if err != nil {
			return nil, fmt.Errorf("failed to read line: %v", err)
		}

		for fieldIndex, value := range lineValues {
			fieldRawValues[fieldIndex] = append(fieldRawValues[fieldIndex], strings.Trim(value, " "))
		}
	}

	for fieldIndex, rawValues := range fieldRawValues {
		fieldName := fieldNames[fieldIndex]
		parsedValues := parseRawStringValues(rawValues)
		field := data.NewField(fieldName, nil, parsedValues)
		fields = append(fields, field)
	}

	frame := data.NewFrame(name, fields...)
	return frame, nil
}

func parseRawStringValues(values []string) interface{} {
	numericValues := []float64{}

	for _, value := range values {
		numericValue, err := strconv.ParseFloat(value, 64)
		if err == nil {
			numericValues = append(numericValues, numericValue)
		}
	}

	if len(values) == len(numericValues) {
		return numericValues
	}

	return values
}
