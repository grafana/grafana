package es2

import (
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"github.com/pkg/errors"
	"gopkg.in/olivere/elastic.v3"
)

const (
	epochMillis = "epoch_millis"
)

var InstanceESQueryParser = &ESQueryParser{}

type ESQueryParser struct{}

func (parser *ESQueryParser) SearchRequest(timeRange *tsdb.TimeRange, model *simplejson.Json, dsInfo *models.ESDataSource) (sr *elastic.SearchRequest, err error) {
	aggId, err := model.Get("refId").String()
	if err != nil {
		return
	}
	// Filter
	start := strconv.FormatInt(timeRange.GetFromAsMsEpoch(), 10)
	end := strconv.FormatInt(timeRange.GetToAsMsEpoch(), 10)
	timeFilter := elastic.NewRangeQuery(dsInfo.TimeField).Gte(start).Lte(end).Format(epochMillis)
	qs := "*"
	if qs, err = model.Get("query").String(); err != nil {
		return sr, err
	}
	queryFilter := elastic.NewQueryStringQuery(qs)

	// Aggregation
	metrics, err := model.Get(models.MetricKey).Array()
	if err != nil {
		return
	}
	dhAgg := elastic.NewDateHistogramAggregation().MinDocCount(0).Field(dsInfo.TimeField).Interval(dsInfo.TimeInterval).ExtendedBounds(start, end).Format(epochMillis)
	for _, a := range metrics {
		metric := simplejson.NewFromAny(a)
		id, err := metric.Get(models.IdKey).String()
		if err != nil {
			continue
		}
		agg, err := parseMetric(metric)
		if err != nil {
			continue
		}
		if agg != nil {
			dhAgg = dhAgg.SubAggregation(id, agg)
		}
	}

	src := elastic.NewSearchSource().Size(0).Query(timeFilter).Query(queryFilter).Aggregation(aggId, dhAgg)
	sr = elastic.NewSearchRequest().SearchTypeQueryThenFetch().SearchSource(src)

	return
}

func parseMetric(metric *simplejson.Json) (elastic.Aggregation, error) {
	t, err := metric.Get(models.TypeKey).String()
	if err != nil {
		return nil, err
	}
	parser := GetMetricParser(t)
	if parser == nil {
		return nil, errors.New(t + " has not been implemented yet")
	}
	return parser.Parse(metric)
}

func GetMetricParser(t string) MetricParser {
	switch t {
	case models.MetricTypeCount:
		return instanceCountMetricParser
	case models.MetricTypeAvg:
		return instanceAvgMetricParser
	case models.MetricTypeSum:
		return instanceSumMetricParser
	case models.MetricTypeMax:
		return instanceMaxMetricParser
	case models.MetricTypeMin:
		return instanceMinMetricParser
	case models.MetricTypeExtendedStats:
		return instanceStatsMetricParser
	case models.MetricTypePercentiles:
		return instancePercentileMetricParser
	case models.MetricTypeCardinality:
		return instanceCardinalityMetricParser
	case models.MetricTypeMovAvg:
		return instanceMovingAvgMetricParser
	case models.MetricTypeDerivative:
		return instanceDerivativeMetricParser
	default:
		return nil
	}
}

type MetricParser interface {
	Parse(metric *simplejson.Json) (elastic.Aggregation, error)
}

type countMetricParser struct{}
type avgMetricParser struct{}
type sumMetricParser struct{}
type maxMetricParser struct{}
type minMetricParser struct{}
type statsMetricParser struct{}
type percentileMetricParser struct{}
type cardinalityMetricParser struct{}
type movingAvgMetricParser struct{}
type derivativeMetricParser struct{}

var (
	instanceCountMetricParser       = &countMetricParser{}
	instanceAvgMetricParser         = &avgMetricParser{}
	instanceSumMetricParser         = &sumMetricParser{}
	instanceMaxMetricParser         = &maxMetricParser{}
	instanceMinMetricParser         = &minMetricParser{}
	instanceStatsMetricParser       = &statsMetricParser{}
	instancePercentileMetricParser  = &percentileMetricParser{}
	instanceCardinalityMetricParser = &cardinalityMetricParser{}
	instanceMovingAvgMetricParser   = &movingAvgMetricParser{}
	instanceDerivativeMetricParser  = &derivativeMetricParser{}
)

func (parser *countMetricParser) Parse(metric *simplejson.Json) (agg elastic.Aggregation, err error) {
	return
}

func (parser *avgMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewAvgAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()

	return agg, nil
}

func (parser *sumMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewSumAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()

	return agg, nil
}

func (parser *maxMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewMaxAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *minMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewMinAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *statsMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewExtendedStatsAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	// cannot deal with sigma for now
	// sigma, err := metric.Get(models.SettingsKey).Get("sigma").String()
	// cannot deal with missing for now
	// m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *percentileMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewPercentilesAggregation().Field(field)
	script, err := metric.Get(models.SettingsKey).Get(models.ScriptKey).Get(models.InlineKey).String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	percents, err := metric.Get(models.SettingsKey).Get("percents").Array()
	percentiles := []float64{}
	for _, p := range percents {
		percent, err := simplejson.NewFromAny(p).Float64()
		if err != nil {
			continue
		}
		percentiles = append(percentiles, percent)
	}
	if len(percentiles) > 0 {
		agg = agg.Percentiles(percentiles...)
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

func (parser *cardinalityMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewCardinalityAggregation().Field(field)
	script, err := metric.Get("inlineScript").String()
	if len(script) > 0 {
		agg = agg.Script(elastic.NewScriptInline(script))
	}
	pt, err := metric.Get(models.SettingsKey).Get("precision_threshold").Int64()
	if err == nil {
		agg = agg.PrecisionThreshold(pt)
	}
	// cannot deal with missing for now
	//m, err := metric.Get(models.SettingsKey).Get("missing").String()
	return agg, nil
}

const (
	movAvgSimpleModelType      = "simple"
	movAvgLinearModelType      = "linear"
	movAvgEWMAModelType        = "ewma"
	movAvgHoltModelType        = "holt"
	movAvgHoltWintersModelType = "holt_winters"
)

func (parser *movingAvgMetricParser) Parse(metric *simplejson.Json) (ret elastic.Aggregation, err error) {
	bucketsPath, err := metric.Get("field").String()
	if err != nil {
		return nil, err
	}
	settings := metric.Get(models.SettingsKey)
	modelType, err := settings.Get("model").String()
	var model elastic.MovAvgModel
	if err != nil {
		return nil, err
	}
	switch modelType {
	case movAvgSimpleModelType:
		model = movAvgSimpleModel(settings)
	case movAvgLinearModelType:
		model = movAvgLinearModel(settings)
	case movAvgEWMAModelType:
		model = movAvgEWMAModel(settings)
	case movAvgHoltModelType:
		model = movAvgHoltModel(settings)
	case movAvgHoltWintersModelType:
		model = movAvgHoltWintersModel(settings)
	default:
		return nil, errors.New(modelType + " is not implemented")
	}
	agg := elastic.NewMovAvgAggregation().Model(model).BucketsPath(bucketsPath)
	if window, err := settings.Get("window").Int(); err == nil {
		agg.Window(window)
	}
	if predict, err := settings.Get("predict").Int(); err == nil {
		agg.Predict(predict)
	}
	if minimize, err := settings.Get("minimize").Bool(); err == nil {
		agg.Minimize(minimize)
	}
	return agg, nil
}

func movAvgSimpleModel(settings *simplejson.Json) elastic.MovAvgModel {
	return elastic.NewSimpleMovAvgModel()
}

func movAvgLinearModel(settings *simplejson.Json) elastic.MovAvgModel {
	return elastic.NewLinearMovAvgModel()
}

func movAvgEWMAModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewEWMAMovAvgModel()
	val, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(val)
	}
	return model
}

func movAvgHoltModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewHoltLinearMovAvgModel()
	alpha, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(alpha)
	}
	beta, err := settings.Get(models.SettingsKey).Get(models.BetaKey).Float64()
	if err == nil {
		model.Beta(beta)
	}
	return model
}

func movAvgHoltWintersModel(settings *simplejson.Json) elastic.MovAvgModel {
	model := elastic.NewHoltWintersMovAvgModel()
	alpha, err := settings.Get(models.SettingsKey).Get(models.AlphaKey).Float64()
	if err == nil {
		model.Alpha(alpha)
	}
	beta, err := settings.Get(models.SettingsKey).Get(models.BetaKey).Float64()
	if err == nil {
		model.Beta(beta)
	}
	gamma, err := settings.Get(models.SettingsKey).Get(models.GammaKey).Float64()
	if err == nil {
		model.Gamma(gamma)
	}
	period, err := settings.Get(models.SettingsKey).Get("period").Int()
	if err == nil {
		model.Period(period)
	}
	pad, err := settings.Get(models.SettingsKey).Get("pad").Bool()
	if err == nil {
		model.Pad(pad)
	}
	return model
}

func (parser *derivativeMetricParser) Parse(metric *simplejson.Json) (elastic.Aggregation, error) {
	field, err := metric.Get(models.FieldKey).String()
	if err != nil {
		return nil, err
	}
	agg := elastic.NewDerivativeAggregation().BucketsPath(field)
	unit, err := metric.Get(models.SettingsKey).Get(models.UnitKey).String()
	if len(unit) > 0 {
		agg = agg.Unit(unit)
	}
	return agg, nil
}
