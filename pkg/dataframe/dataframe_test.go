package dataframe

import (
	"bufio"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestLoadingDataFrameFromCSV(t *testing.T) {
	data, err := os.Open("./testdata/simpleTimeSeries.csv")
	if err != nil {
		t.Error(err)
		return
	}
	schema := Schema{TimeColumnSchema{Format: time.RFC3339}, NumberColumnSchema{}}
	df, err := FromCSV(
		bufio.NewReader(data),
		true,
		schema)
	if err != nil {
		t.Error(err)
		return
	}
	df.Type = TimeSeriesFrame
	fmt.Println(df)
}
