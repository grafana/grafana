package dataframe

import (
	"encoding/csv"
	"io"
)

// FromCSV is a simple CSV loader, primarily for testing
func FromCSV(reader io.Reader, hasHeader bool, schema Schema) (*DataFrame, error) {
	df := new(DataFrame)
	csvReader := csv.NewReader(reader)
	i := 0
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		if i == 0 && hasHeader {
			for fieldIdx, header := range record {
				schema[fieldIdx].SetName(header)
				df.Schema = append(df.Schema, schema[fieldIdx])
			}
			i++
			continue
		}

		row := []Field{}
		for fieldIdx, fieldValue := range record {
			v, err := schema[fieldIdx].Extract(fieldValue)
			if err != nil {
				return nil, err
			}
			row = append(row, Field{v})
		}
		df.Records = append(df.Records, row)
	}
	return df, nil
}
