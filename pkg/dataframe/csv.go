package dataframe

import (
	"encoding/csv"
	"io"
)

// FromCSV is a simple CSV loader, primarily for testing
func FromCSV(reader io.Reader, hasHeader bool, cs ColumnSpecifiers) (*DataFrame, error) {
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
				df.Columns = append(df.Columns, Column{
					Name: header,
					// TODO check len
					Type: cs[fieldIdx].ColumnType(),
				})
			}
			i++
			continue
		}

		row := []Field{}
		for fieldIdx, fieldValue := range record {
			v, err := cs[fieldIdx].Extract(fieldValue)
			if err != nil {
				return nil, err
			}
			row = append(row, Field{v})
		}
		df.Records = append(df.Records, row)
	}
	return df, nil
}
