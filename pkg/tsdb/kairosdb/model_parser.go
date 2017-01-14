package kairosdb


import (
	"regexp"
	"strconv"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	regexpIntervalPattern   *regexp.Regexp = regexp.MustCompile(`(\d+(?:\.\d+)?)([Mwdhmsy])`)
	regexpIntervalMsPattern *regexp.Regexp = regexp.MustCompile(`(\d+(?:\.\d+)?)(ms)`)
	// MILLISECONDS, SECONDS, MINUTES, HOURS, DAYS, WEEKS, MONTHS, YEARS)
	timeUnitToMilliseconds = map[string]uint{
		"y": 31536000000,
		"M": 2592000000,
		"w": 604800000,
		"d": 86400000,
		"h": 3600000,
		"m": 60000,
		"s": 1000,
		"ms": 1}

	timeUnitToName = map[string]string{
		"y": "years",
		"M": "months",
		"w": "weeks",
		"d": "days",
		"h": "hours",
		"m": "minutes",
		"s": "seconds",
		"ms":"milliseconds"}
)

type KairosDbMetricParser struct{}

func (mp *KairosDbMetricParser) Parse(model *simplejson.Json) map[string]interface{} {

	metric := make(map[string]interface{})

	// Setting metric
	metric["name"] = model.Get("metric").MustString()

	// Setting aggregators
	horizontalAggregators, aggsCheck := model.CheckGet("horizontalAggregators")
	
	if aggsCheck && len(horizontalAggregators.MustArray()) > 0 {

		aggregators := make([]interface{}, len(horizontalAggregators.MustArray()))

		for i, aggrObj := range horizontalAggregators.MustArray() {

			aggrJson := simplejson.NewFromAny(aggrObj)
			aggregator := mp.parseAggregator(aggrJson)

			aggregators[i] = aggregator
		}
		metric["aggregators"] = aggregators
	}

	// Setting group by
	var groupBy []interface{}

	if groupByTags, groupByTagsCheck := model.CheckGet("groupByTags"); groupByTagsCheck {

		gt := make(map[string]interface{})
		gt["name"] = "tag"
		gt["tags"] = groupByTags.MustArray()

		groupBy = append(groupBy, gt)

	}

	groupByOther, groupByOtherCheck := model.CheckGet("nonTagGroupBys")
	
	if groupByOtherCheck && len(groupByOther.MustArray()) > 0 {
		for _, groupByObj := range groupByOther.MustArray() {
			
			gbJson := simplejson.NewFromAny(groupByObj)
			
			if gbJson.Get("name").MustString() == "time" {
				rangeSize, _ := convertToSamplingInterval(gbJson.Get("range_size").MustString())
				gbJson.Set("range_size", rangeSize)
				
			}
			
			groupBy = append(groupBy, gbJson.MustMap())
		}
	}
	if groupBy != nil {
		metric["group_by"] = groupBy
	}
	
	// Setting tags
	tags, tagsCheck := model.CheckGet("tags")
	if tagsCheck && len(tags.MustMap()) > 0 {
		metric["tags"] = tags.MustMap()
	}

	return metric

}

func (mp *KairosDbMetricParser) parseAggregator(aggrJson *simplejson.Json) map[string]interface{} {
	aggregator := make(map[string]interface{})

	aggregator["name"] = aggrJson.Get("name").MustString()

	samplingRate, samplingRateCheck := aggrJson.CheckGet("sampling_rate")
	if samplingRateCheck {
		aggregator["align_sampling"] = true

		sampling, err := convertToSamplingInterval(samplingRate.MustString())
		aggregator["sampling"] = sampling

		if err != nil {
			plog.Info("Failed to parse query sampling rate", "samplingRate", samplingRate) 
		}
	}
	// @todo: fix sampler aggregator
	if unit, unitCheck := aggrJson.CheckGet("unit"); unitCheck {
		aggregator["unit"] = unit.MustString() + "s"
	}

	factor, factorCheck := aggrJson.CheckGet("factor")
	if factorCheck && aggregator["name"] == "div" {
		aggregator["divisor"], _ = strconv.ParseFloat(factor.MustString(), 64)

	} else if factorCheck && aggregator["name"] == "scale" {
		aggregator["factor"], _ = strconv.ParseFloat(factor.MustString(), 64) 

	}
	
	if percentile, percentileCheck := aggrJson.CheckGet("percentile"); percentileCheck {
		aggregator["percentile"], _ = strconv.ParseFloat(percentile.MustString(), 64)
	}

	if trim, trimCheck := aggrJson.CheckGet("trim"); trimCheck {
		aggregator["trim"] = trim.MustString()
	}

	return aggregator
}

func convertToSamplingInterval(samplingRate string) (map[string]interface{}, error) {

	samplingInterval := make(map[string]interface{})
	
	matches := regexpIntervalMsPattern.FindStringSubmatch(samplingRate)
	if matches == nil {
		matches = regexpIntervalPattern.FindStringSubmatch(samplingRate)
	}

	unit := matches[2]
	value, err := strconv.ParseInt(matches[1], 10, 64)

	if err != nil {
		
		valueFloat, err := strconv.ParseFloat(matches[1], 32)
		
		if err != nil {
			return samplingInterval, err
		}
		
		value = int64(valueFloat * float64(timeUnitToMilliseconds[unit]))
		unit = "ms"
	} 

	samplingInterval["value"] = value
	samplingInterval["unit"] = timeUnitToName[unit]

	return samplingInterval, nil
}
