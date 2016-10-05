package influxdb

import "github.com/grafana/grafana/pkg/components/simplejson"

type InfluxdbQueryParser struct{}

func (qp *InfluxdbQueryParser) Parse(model *simplejson.Json) (*Query, error) {
	policy := model.Get("policy").MustString("default")

	measurement, err := model.Get("measurement").String()
	if err != nil {
		return nil, err
	}

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

	return &Query{
		Measurement:  measurement,
		Policy:       policy,
		ResultFormat: resultFormat,
		GroupBy:      groupBys,
		Tags:         tags,
		Selects:      selects,
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

		key, err := tagJson.Get("key").String()
		if err != nil {
			return nil, err
		}

		operator, err := tagJson.Get("operator").String()
		if err != nil {
			return nil, err
		}

		value, err := tagJson.Get("value").String()
		if err != nil {
			return nil, err
		}

		result = append(result, &Tag{Key: key, Operator: operator, Value: value})
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

		pv, err := param.String()
		if err != nil {
			return nil, err
		}
		params = append(params, pv)
	}

	return &QueryPart{Type: typ, Params: params}, nil
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
