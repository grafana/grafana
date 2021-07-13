package influxdb

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

type InfluxdbQueryParser struct{}

func (qp *InfluxdbQueryParser) Parse(model *simplejson.Json, dsInfo *models.DatasourceInfo) (*Query, error) {
	policy := model.Get("policy").MustString("default")
	rawQuery := model.Get("query").MustString("")
	useRawQuery := model.Get("rawQuery").MustBool(false)
	alias := model.Get("alias").MustString("")
	tz := model.Get("tz").MustString("")

	measurement := model.Get("measurement").MustString("")

	resultFormat, err := model.Get("resultFormat").String()
	if err != nil {
		return nil, err
	}

	tags, err := qp.parseTags(model)
	if err != nil {
		return nil, err
	}

	groupBys, err := qp.parseGroupBy(model)
	if err != nil {
		return nil, err
	}

	selects, err := qp.parseSelects(model)
	if err != nil {
		return nil, err
	}

	parsedInterval, err := GetIntervalFrom(dsInfo, model, time.Millisecond*1)
	if err != nil {
		return nil, err
	}

	return &Query{
		Measurement:  measurement,
		Policy:       policy,
		ResultFormat: resultFormat,
		GroupBy:      groupBys,
		Tags:         tags,
		Selects:      selects,
		RawQuery:     rawQuery,
		Interval:     parsedInterval,
		Alias:        alias,
		UseRawQuery:  useRawQuery,
		Tz:           tz,
	}, nil
}

func (qp *InfluxdbQueryParser) parseSelects(model *simplejson.Json) ([]*Select, error) {
	var result []*Select

	for _, selectObj := range model.Get("select").MustArray() {
		selectJson := simplejson.NewFromAny(selectObj)
		var parts Select

		for _, partObj := range selectJson.MustArray() {
			part := simplejson.NewFromAny(partObj)
			queryPart, err := qp.parseQueryPart(part)
			if err != nil {
				return nil, err
			}

			parts = append(parts, *queryPart)
		}

		result = append(result, &parts)
	}

	return result, nil
}

func (*InfluxdbQueryParser) parseTags(model *simplejson.Json) ([]*Tag, error) {
	var result []*Tag
	for _, t := range model.Get("tags").MustArray() {
		tagJson := simplejson.NewFromAny(t)
		tag := &Tag{}
		var err error

		tag.Key, err = tagJson.Get("key").String()
		if err != nil {
			return nil, err
		}

		tag.Value, err = tagJson.Get("value").String()
		if err != nil {
			return nil, err
		}

		operator, err := tagJson.Get("operator").String()
		if err == nil {
			tag.Operator = operator
		}

		condition, err := tagJson.Get("condition").String()
		if err == nil {
			tag.Condition = condition
		}

		result = append(result, tag)
	}

	return result, nil
}

func (*InfluxdbQueryParser) parseQueryPart(model *simplejson.Json) (*QueryPart, error) {
	typ, err := model.Get("type").String()
	if err != nil {
		return nil, err
	}

	var params []string
	for _, paramObj := range model.Get("params").MustArray() {
		param := simplejson.NewFromAny(paramObj)

		stringParam, err := param.String()
		if err == nil {
			params = append(params, stringParam)
			continue
		}

		intParam, err := param.Int()
		if err == nil {
			params = append(params, strconv.Itoa(intParam))
			continue
		}

		return nil, err
	}

	qp, err := NewQueryPart(typ, params)
	if err != nil {
		return nil, err
	}

	return qp, nil
}

func (qp *InfluxdbQueryParser) parseGroupBy(model *simplejson.Json) ([]*QueryPart, error) {
	var result []*QueryPart
	for _, groupObj := range model.Get("groupBy").MustArray() {
		groupJson := simplejson.NewFromAny(groupObj)
		queryPart, err := qp.parseQueryPart(groupJson)
		if err != nil {
			return nil, err
		}

		result = append(result, queryPart)
	}

	return result, nil
}

func GetIntervalFrom(dsInfo *models.DatasourceInfo, queryModel *simplejson.Json, defaultInterval time.Duration) (time.Duration, error) {
	interval := queryModel.Get("interval").MustString("")

	// intervalMs field appears in the v2 plugins API and should be preferred
	// if 'interval' isn't present.
	if interval == "" {
		intervalMS := queryModel.Get("intervalMs").MustInt(0)
		if intervalMS != 0 {
			return time.Duration(intervalMS) * time.Millisecond, nil
		}
	}

	if interval == "" && dsInfo != nil && dsInfo.TimeInterval != "" {
		dsInterval := dsInfo.TimeInterval
		if dsInterval != "" {
			interval = dsInterval
		}
	}

	if interval == "" {
		return defaultInterval, nil
	}

	interval = strings.Replace(strings.Replace(interval, "<", "", 1), ">", "", 1)
	isPureNum, err := regexp.MatchString(`^\d+$`, interval)
	if err != nil {
		return time.Duration(0), err
	}
	if isPureNum {
		interval += "s"
	}
	parsedInterval, err := time.ParseDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}
