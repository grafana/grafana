package models

import (
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type ESDataSource struct {
	*models.DataSource
	IndexPrefix   string
	IndexPattern  string
	IndexInterval string
	TimeField     string
	TimeInterval  string
	Version       int
}

const (
	IndexNoPattern = "NoPattern"
	IndexHourly    = "Hourly"
	IndexDaily     = "Daily"
	IndexWeekly    = "Weekly"
	IndexMonthly   = "Monthly"
	IndexYearly    = "Yearly"

	ESDefaultTime         = "@timestamp"
	ESDefaultTimeInterval = "10s"

	AggTypeTerms         = "terms"
	AggTypeFilters       = "filters"
	AggTypeGeoHashGrid   = "geo_hash_grid"
	AggTypeHistogram     = "histogram"
	AggTypeDateHistogram = "date_histogram"

	MetricTypeCount         = "count"
	MetricTypeAvg           = "avg"
	MetricTypeSum           = "sum"
	MetricTypeMax           = "max"
	MetricTypeMin           = "min"
	MetricTypeExtendedStats = "extended_stats"
	MetricTypePercentiles   = "percentiles"
	MetricTypeCardinality   = "cardinality"
	MetricTypeMovAvg        = "moving_avg"
	MetricTypeDerivative    = "derivative"

	epochMillis = "epoch_millis"

	// common used key
	MetricKey   = "metrics"
	SettingsKey = "settings"
	FieldKey    = "field"
	UnitKey     = "unit"
	AlphaKey    = "alpha"
	BetaKey     = "beta"
	GammaKey    = "gamma"
	ScriptKey   = "script"
	InlineKey   = "inline"
	TypeKey     = "type"
	IdKey       = "id"
)

var (
	instanceNoPatternIndicesRanger = &noPatternIndicesRanger{}
	instanceHourlyIndicesRanger    = &hourlyIndicesRanger{}
	instanceDailyIndicesRanger     = &dailyIndicesRanger{}
	instanceWeeklyIndicesRanger    = &weeklyIndicesRanger{}
	instanceMonthlyIndicesRanger   = &monthlyIndicesRanger{}
	instanceYearlyIndicesRanger    = &yearlyIndicesRanger{}
)

func NewEsDataSource(dsInfo *models.DataSource) (result *ESDataSource, err error) {
	result = &ESDataSource{
		DataSource: dsInfo,
	}
	if dsInfo.Type != "elasticsearch" {
		return result, errors.New("data source should be elasticsearch, but got " + dsInfo.Type)
	}
	result.IndexPrefix, result.IndexInterval, result.IndexPattern = parseIndex(dsInfo)
	result.TimeField = dsInfo.JsonData.Get("timeField").MustString(ESDefaultTime)
	result.TimeInterval = dsInfo.JsonData.Get("timeInterval").MustString(ESDefaultTimeInterval)
	result.Version = dsInfo.JsonData.Get("esVersion").MustInt(5)
	return result, nil
}

func parseIndex(dsInfo *models.DataSource) (indexPrefix, indexInterval, indexPattern string) {
	indexInterval = dsInfo.JsonData.Get("interval").MustString(IndexNoPattern)
	if indexInterval == IndexNoPattern {
		indexPrefix = dsInfo.Database
		return
	}
	start := strings.Index(dsInfo.Database, "[")
	end := strings.Index(dsInfo.Database, "]")
	indexPrefix = dsInfo.Database[start+1 : end]
	indexPattern = dsInfo.Database[end+1 : len(dsInfo.Database)]
	return
}

type IndicesRanger interface {
	FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string)
}

func GetIndicesRanger(indexInterval string) IndicesRanger {
	switch indexInterval {
	case IndexHourly:
		return instanceHourlyIndicesRanger
	case IndexDaily:
		return instanceDailyIndicesRanger
	case IndexWeekly:
		return instanceWeeklyIndicesRanger
	case IndexMonthly:
		return instanceMonthlyIndicesRanger
	case IndexYearly:
		return instanceYearlyIndicesRanger
	default:
		return instanceNoPatternIndicesRanger
	}
}

type noPatternIndicesRanger struct{}
type hourlyIndicesRanger struct{}
type dailyIndicesRanger struct{}
type weeklyIndicesRanger struct{}
type monthlyIndicesRanger struct{}
type yearlyIndicesRanger struct{}

func (p *noPatternIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	indices = append(indices, indexPrefix)
	return
}

func (p *hourlyIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	start := timeRange.MustGetFrom()
	end := timeRange.MustGetTo()
	for iTime := start; iTime.Before(end) || iTime.Equal(end); iTime = iTime.Add(time.Hour) {
		index := indexPrefix + formatTime(iTime, indexPattern)
		indices = append(indices, index)
	}
	return
}

func (p *dailyIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	start := timeRange.MustGetFrom()
	end := timeRange.MustGetTo()
	for iTime := start; iTime.Before(end) || iTime.Equal(end); iTime = iTime.AddDate(0, 0, 1) {
		index := indexPrefix + formatTime(iTime, indexPattern)
		indices = append(indices, index)
	}
	return
}

func (p *weeklyIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	start := timeRange.MustGetFrom()
	end := timeRange.MustGetTo()
	for iTime := start; iTime.Before(end) || iTime.Equal(end); iTime = iTime.AddDate(0, 0, 7) {
		index := indexPrefix + formatTime(iTime, indexPattern)
		indices = append(indices, index)
	}
	return
}

func (p *monthlyIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	start := timeRange.MustGetFrom()
	end := timeRange.MustGetTo()
	for iTime := start; iTime.Before(end) || iTime.Equal(end); iTime = iTime.AddDate(0, 1, 0) {
		index := indexPrefix + formatTime(iTime, indexPattern)
		indices = append(indices, index)
	}
	return
}

func (p *yearlyIndicesRanger) FilterIndices(indexPrefix, indexPattern string, timeRange *tsdb.TimeRange) (indices []string) {
	start := timeRange.MustGetFrom()
	end := timeRange.MustGetTo()
	for iTime := start; iTime.Before(end) || iTime.Equal(end); iTime = iTime.AddDate(1, 0, 0) {
		index := indexPrefix + formatTime(iTime, indexPattern)
		indices = append(indices, index)
	}
	return
}

func formatTime(ti time.Time, format string) string {
	return Date(ti.Unix(), format)
}
