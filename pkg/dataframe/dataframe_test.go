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
	columnSpecifiers := ColumnSpecifiers{TimeColumnSpecifier{Format: time.RFC3339}, NumberColumnSpecifier{}}
	df, err := FromCSV(
		bufio.NewReader(data),
		true,
		columnSpecifiers)
	if err != nil {
		t.Error(err)
		return
	}
	df.Type = TimeSeriesFrame
	fmt.Println(df)
}
