package dataframe

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/apache/arrow/go/arrow/ipc"
)

// Not really tests ... just my repl/notebook for now

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
	_ = v
	fmt.Println(string(v))
}

func TestLoadingNumberDataFrameFromCSVAndWritingToArrow(t *testing.T) {
	data, err := os.Open("./testdata/stringNumber.csv")
	if err != nil {
		t.Error(err)
		return
	}
	schema := Schema{
		NewStringColumn(),
		NewNumberColumn(),
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
	_ = v
	tableReader := df.ToArrow()

	outFile, err := os.OpenFile("/home/kbrandt/tmp/arrowstuff", os.O_APPEND|os.O_WRONLY|os.O_CREATE, os.FileMode(0644))
	if err != nil {
		t.Error(err)
		return
	}

	writer, err := ipc.NewFileWriter(outFile, ipc.WithSchema(tableReader.Schema()))
	if err != nil {
		t.Error(err)
		return
	}

	for tableReader.Next() {
		rec := tableReader.Record()
		err := writer.Write(rec)
		if err != nil {
			t.Error(err)
			return
		}
	}
	err = writer.Close()
	if err != nil {
		t.Error(err)
		return
	}
	err = outFile.Close()
	if err != nil {
		t.Error(err)
		return
	}

}
