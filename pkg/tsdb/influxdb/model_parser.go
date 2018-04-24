package influxdb

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type InfluxdbQueryParser struct{}

func (qp *InfluxdbQueryParser) Parse(model *simplejson.Json, dsInfo *models.DataSource) (*Query, error) {
	policy := model.Get("policy").MustString("default")
	rawQuery := model.Get("query").MustString("")
	useRawQuery := model.Get("rawQuery").MustBool(false)
	alias := model.Get("alias").MustString("")

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

	parsedInterval, err := tsdb.GetIntervalFrom(dsInfo, model, time.Millisecond*1)
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
