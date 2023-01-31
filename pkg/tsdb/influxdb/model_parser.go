package influxdb

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type InfluxdbQueryParser struct{}

func (qp *InfluxdbQueryParser) Parse(query backend.DataQuery) (*Query, error) {
	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		return nil, fmt.Errorf("couldn't unmarshal query")
	}

	policy := model.Get("policy").MustString("default")
	rawQuery := model.Get("query").MustString("")
	useRawQuery := model.Get("rawQuery").MustBool(false)
	alias := model.Get("alias").MustString("")
	tz := model.Get("tz").MustString("")
	limit := model.Get("limit").MustString("")
	slimit := model.Get("slimit").MustString("")
	orderByTime := model.Get("orderByTime").MustString("")

	measurement := model.Get("measurement").MustString("")

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

	interval := query.Interval

	// we make sure it is at least 1 millisecond
	minInterval := time.Millisecond

	if interval < minInterval {
		interval = minInterval
	}

	return &Query{
		Measurement: measurement,
		Policy:      policy,
		GroupBy:     groupBys,
		Tags:        tags,
		Selects:     selects,
		RawQuery:    rawQuery,
		Interval:    interval,
		Alias:       alias,
		UseRawQuery: useRawQuery,
		Tz:          tz,
		Limit:       limit,
		Slimit:      slimit,
		OrderByTime: orderByTime,
	}, nil
}

func (qp *InfluxdbQueryParser) parseSelects(model *simplejson.Json) ([]*Select, error) {
	selectObjs := model.Get("select").MustArray()
	result := make([]*Select, 0, len(selectObjs))

	for _, selectObj := range selectObjs {
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
	tags := model.Get("tags").MustArray()
	result := make([]*Tag, 0, len(tags))
	for _, t := range tags {
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
	groupBy := model.Get("groupBy").MustArray()
	result := make([]*QueryPart, 0, len(groupBy))
	for _, groupObj := range groupBy {
		groupJson := simplejson.NewFromAny(groupObj)
		queryPart, err := qp.parseQueryPart(groupJson)
		if err != nil {
			return nil, err
		}

		result = append(result, queryPart)
	}

	return result, nil
}
