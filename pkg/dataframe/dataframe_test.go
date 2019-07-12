package dataframe

import (
	"bufio"
	"encoding/json"
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
	schema := Schema{
		NewTimeColumn(time.RFC3339),
		NewNumberColumn(),
		NewStringColumn(),
	}
	df, err := FromCSV(
		bufio.NewReader(data),
		true,
		schema)
	if err != nil {
		t.Error(err)
		return
	}
	df.Type = TimeSeriesFrame
	v, err := json.MarshalIndent(df, "", "    ")
	if err != nil {
		t.Error(err)
		return
	}
	fmt.Println(string(v))
}
