package models

import (
	"testing"
	"time"

	"github.com/bmizerany/assert"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func TestParseIndex(t *testing.T) {
	json := `{"esVersion":2, "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "plainIndex",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "plainIndex")
	assert.Equal(t, esDs.IndexPattern, "")
	assert.Equal(t, esDs.IndexInterval, IndexNoPattern)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)
}

func TestParseIndexDaily(t *testing.T) {
	//%!s(*simplejson.Json=&{map[esVersion:2 timeField:time_local timeInterval:10s]})
	json := `{"esVersion":2, "interval":"Daily", "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "[index-]YYYY.MM.DD",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "index-")
	assert.Equal(t, esDs.IndexPattern, "YYYY.MM.DD")
	assert.Equal(t, esDs.IndexInterval, IndexDaily)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)

	predictor := GetIndicesRanger(esDs.IndexInterval)
	if predictor == nil {
		t.Error("initial predictor error")
	}
	is := predictor.FilterIndices(esDs.IndexPrefix, esDs.IndexPattern, &tsdb.TimeRange{From: "now-72h", To: "now", Now: time.Now()})
	assert.Equal(t, len(is), 4)
}

func TestParseIndexWeekly(t *testing.T) {
	//%!s(*simplejson.Json=&{map[esVersion:2 timeField:time_local timeInterval:10s]})
	json := `{"esVersion":2, "interval":"Weekly", "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "[index-]GGGG.WW",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "index-")
	assert.Equal(t, esDs.IndexPattern, "GGGG.WW")
	assert.Equal(t, esDs.IndexInterval, IndexWeekly)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)

	predictor := GetIndicesRanger(esDs.IndexInterval)
	if predictor == nil {
		t.Error("initial predictor error")
	}
	is := predictor.FilterIndices(esDs.IndexPrefix, esDs.IndexPattern, &tsdb.TimeRange{"1483265342000", "1484993342000", time.Now()})
	assert.Equal(t, len(is), 3)
}

func TestParseIndexYearly(t *testing.T) {
	json := `{"esVersion":2, "interval":"Yearly", "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "[index-]YYYY",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "index-")
	assert.Equal(t, esDs.IndexPattern, "YYYY")
	assert.Equal(t, esDs.IndexInterval, IndexYearly)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)

	predictor := GetIndicesRanger(esDs.IndexInterval)
	if predictor == nil {
		t.Error("initial predictor error")
	}
	is := predictor.FilterIndices(esDs.IndexPrefix, esDs.IndexPattern, &tsdb.TimeRange{"1453370942000", "1484993342000", time.Now()})
	assert.Equal(t, len(is), 2)
}

func TestParseIndexMonthly(t *testing.T) {
	json := `{"esVersion":2, "interval":"Monthly", "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "[index-]YYYY.MM",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "index-")
	assert.Equal(t, esDs.IndexPattern, "YYYY.MM")
	assert.Equal(t, esDs.IndexInterval, IndexMonthly)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)

	predictor := GetIndicesRanger(esDs.IndexInterval)
	if predictor == nil {
		t.Error("initial predictor error")
	}
	is := predictor.FilterIndices(esDs.IndexPrefix, esDs.IndexPattern, &tsdb.TimeRange{"1482314942000", "1484993342000", time.Now()})
	assert.Equal(t, len(is), 2)
}

func TestParseIndexHourly(t *testing.T) {
	json := `{"esVersion":2, "interval":"Hourly", "timeField":"time_local", "timeInterval":"10s"}`
	jsonData, err := simplejson.NewJson([]byte(json))
	if err != nil {
		t.Error(err)
	}
	ds := &models.DataSource{
		Type:     "elasticsearch",
		Database: "[index-]YYYY.MM.DD.HH",
		JsonData: jsonData,
	}
	esDs, err := NewEsDataSource(ds)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, esDs.IndexPrefix, "index-")
	assert.Equal(t, esDs.IndexPattern, "YYYY.MM.DD.HH")
	assert.Equal(t, esDs.IndexInterval, IndexHourly)
	assert.Equal(t, esDs.TimeField, "time_local")
	assert.Equal(t, esDs.TimeInterval, "10s")
	assert.Equal(t, esDs.Version, 2)

	predictor := GetIndicesRanger(esDs.IndexInterval)
	if predictor == nil {
		t.Error("initial predictor error")
	}
	is := predictor.FilterIndices(esDs.IndexPrefix, esDs.IndexPattern, &tsdb.TimeRange{"1484906942000", "1484993342000", time.Now()})
	assert.Equal(t, len(is), 25)
}
