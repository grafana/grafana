package testdatasource

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func (p *testDataPlugin) handleCategoricalDataScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		frame := data.NewFrame(q.RefID,
			data.NewField("location", nil, []string{}),
			data.NewField("temperature", nil, []int64{}),
			data.NewField("humidity", nil, []int64{}),
			data.NewField("pressure", nil, []int64{}),
		)

		for i := 0; i < len(houseLocations); i++ {
			frame.AppendRow(houseLocations[i], rand.Int63n(40+40)-40, rand.Int63n(100), rand.Int63n(1020-900)+900)
		}
		respD := resp.Responses[q.RefID]
		respD.Frames = append(respD.Frames, frame)
		resp.Responses[q.RefID] = respD
	}

	return resp, nil
}

func (p *testDataPlugin) handleCsvData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
		return nil, fmt.Errorf("invalid csv file name")
	}

	filePath := path.Join(p.Cfg.StaticRootPath, "testdata", fileName)
	fileReader, err := os.Open(filePath)

	defer fileReader.Close()

	if err != nil {
		return nil, fmt.Errorf("failed to open csv file, %v", err)
	}

	reader := csv.NewReader(fileReader)

	// Read the header records
	headerFields, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed read header line %v", err)
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
			return nil, fmt.Errorf("failed read line %v", err)
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

	frame := data.NewFrame(fileName, fields...)
	return frame, nil
}

func parseRawStringValues(values []string) interface{} {
	numericValues := []float64{}

	for _, value := range values {
		numericValue, err := strconv.ParseFloat(value, 64)
		if err == nil {
			numericValues = append(numericValues, numericValue)
		} else {
			fmt.Printf("Error reading %v %v", numericValue, err)
		}
	}

	if len(values) == len(numericValues) {
		return numericValues
	}

	return values
}
