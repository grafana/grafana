package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"

	elastic "gopkg.in/olivere/elastic.v3"
)

type EsExecutor struct {
	*tsdb.DataSourceInfo
	log log.Logger
}

func NewEsExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &EsExecutor{
		DataSourceInfo: dsInfo,
		log:            log.New("tsdb.elasticsearch"),
	}
}

func init() {
	tsdb.RegisterExecutor("elasticsearch", NewEsExecutor)
}

func (e *EsExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	batchResult := &tsdb.BatchResult{}

	//convert dashboard query datastructure to helper objects
	esQuerys := e.convertQueries(queries)
	for _, esQuery := range esQuerys {
		//debug output
		fmt.Printf("inspect esquery %+v\n", esQuery)

		//build and execute search
		searchResult := e.search(esQuery, context)
		if searchResult != nil {
			//convert the result to output format
			queryResults := e.convertResult(esQuery, searchResult)

			//create map if not exists
			if batchResult.QueryResults == nil {
				batchResult.QueryResults = make(map[string]*tsdb.QueryResult)
			}

			for _, result := range queryResults {
				//put result into map
				name := result.RefId
				if len(result.Series) > 0 {
					name = result.Series[0].Name
				}
				batchResult.QueryResults[name] = result
			}
		}
	}

	return batchResult
}

func (e *EsExecutor) buildClient(dataSourceInfo *tsdb.DataSourceInfo) *elastic.Client {
	// Create a client
	var clientOptions []elastic.ClientOptionFunc
	clientOptions = append(clientOptions, elastic.SetURL(dataSourceInfo.Url))
	if dataSourceInfo.BasicAuth {
		clientOptions = append(clientOptions, elastic.SetBasicAuth(dataSourceInfo.BasicAuthUser, dataSourceInfo.BasicAuthPassword))
	}
	client, err := elastic.NewClient(clientOptions...)
	if err != nil {
		fmt.Printf("\nERROR: creating elastic client \n%#v", err)
	}
	return client
}

func (e *EsExecutor) convertQueries(queries tsdb.QuerySlice) []EsQuery {
	var esQuerys []EsQuery

	for _, query := range queries { //TODO allow more then one query
		str, _ := query.Model.EncodePretty()
		//debug print query
		fmt.Printf("\nElastic query json model: \n%s", str)
		e.log.Info("Elastic query")

		var esQuery EsQuery
		jerr := json.Unmarshal(str, &esQuery)
		if jerr != nil {
			fmt.Println("json parser error %s", jerr)
		} else {
			esQuery.DataSource = query.DataSource
			esQuerys = append(esQuerys, esQuery)
		}
	}

	return esQuerys
}

func (e *EsExecutor) search(esQuery EsQuery, context *tsdb.QueryContext) *elastic.SearchResult {
	//build the elastic client
	esClient := e.buildClient(esQuery.DataSource)

	//build and execute search
	searchService := esClient.Search().
		Index("collectd-*"). // search in index //TODO set the correct index
		SearchType("count").
		Size(0).     //unlimited results returned
		Pretty(true) // pretty print request and response JSON
	searchService = e.buildQuery(searchService, esQuery, context)
	searchService = e.buildAggregations(searchService, esQuery, context)

	// execute
	searchResult, err := searchService.Do()
	if err != nil {
		// Handle error
		fmt.Printf("\nERROR: executing elastic query \n%#v\n%s", err, err)
		return nil
	}

	return searchResult
}

func (e *EsExecutor) convertResult(esQuery EsQuery, searchResult *elastic.SearchResult) []*tsdb.QueryResult {
	// walk over it in dashboard order
	return e.processAggregation(esQuery, 0, &searchResult.Aggregations)
}

func (e *EsExecutor) processAggregation(esQuery EsQuery, index int32, aggregation *elastic.Aggregations) []*tsdb.QueryResult {
	var results []*tsdb.QueryResult

	bAgg := esQuery.BucketAggs[index]

	if bAgg.AggType == "date_histogram" {
		bucketAgg, found := aggregation.DateHistogram(bAgg.Id)
		if found != true {
			fmt.Printf("Can not find Aggregation with id %s\n", bAgg.Id)
		}
		result := e.processDateHistogram(esQuery, bucketAgg)
		results = append(results, result)
	} else if bAgg.AggType == "terms" {
		bucketAgg, found := aggregation.Terms(bAgg.Id)
		if found != true {
			fmt.Printf("Can not find Aggregation with id %s\n", bAgg.Id)
		}
		aggResults := e.processTerms(esQuery, index, bucketAgg)
		for _, result := range aggResults {
			results = append(results, result)
		}
	} else {
		fmt.Printf("Aggregation type currently not supported: %s\n", bAgg.AggType)
	}
	return results
}

func (e *EsExecutor) processTerms(esQuery EsQuery, index int32, bucketAgg *elastic.AggregationBucketKeyItems) []*tsdb.QueryResult {
	var results []*tsdb.QueryResult

	for _, bucket := range bucketAgg.Buckets {
		aggResults := e.processAggregation(esQuery, index+1, &bucket.Aggregations)
		for _, result := range aggResults {
			for _, series := range result.Series { //TODO fix this in a better way
				var termString string
				if bucket.KeyAsString != nil {
					termString = *bucket.KeyAsString
				} else {
					string, ok := bucket.Key.(string)
					if ok {
						termString = string
					}
				}
				series.Name = series.Name + termString
			}
			results = append(results, result)
		}
	}

	return results
}

func (e *EsExecutor) processDateHistogram(esQuery EsQuery, bucketAgg *elastic.AggregationBucketHistogramItems) *tsdb.QueryResult {
	queryRes := &tsdb.QueryResult{}

	// walk over it in dashboard order
	for i := 0; i < len(esQuery.Metrics); i++ {
		mAgg := esQuery.Metrics[i]
		if mAgg.Hide == false { //TODO raise error if there is more then one metric visible
			var values [][2]*float64
			for _, bucket := range bucketAgg.Buckets {
				if mAgg.MetricType == "extended_stats" {
					//extended, found := bucket.Aggregations.ExtendedStats(mAgg.Id)
					//if mAgg.Meta.Count {
					//TODO
					//}
					fmt.Printf("Aggregation type currently not supported: %s\n", mAgg.MetricType)
				} else if mAgg.MetricType == "percentiles" {
					//TODO
					//Percentiles
					fmt.Printf("Aggregation type currently not supported: %s\n", mAgg.MetricType)
				} else {
					//everything with json key value should work with this
					derivative, found := bucket.Aggregations.Derivative(mAgg.Id) //TODO use correct type
					var valueRow [2]*float64
					bucketPoint := float64(bucket.Key)
					valueRow[1] = &bucketPoint
					if found && derivative.Value != nil {
						valueRow[0] = derivative.Value
					} else {
						//use doc_count
						point := float64(bucket.DocCount)
						valueRow[0] = &point
					}
					values = append(values, valueRow)
				}
			}

			//get query name
			queryName := esQuery.Alias //TODO the naming seams to be odd
			if queryName == "" {
				queryName = esQuery.RefId
			}
			queryName = queryName + mAgg.Id //TODO we should also append the term

			//append time series to results
			queryRes.RefId = esQuery.RefId
			queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
				Name:   queryName,
				Points: values,
			})

			//debug print
			fmt.Printf("query result series %s: %+v\n", queryRes.Series[0].Name, queryRes.Series[0].Points)
		}
	}

	return queryRes
}

func (e *EsExecutor) buildQuery(searchService *elastic.SearchService, esQuery EsQuery, context *tsdb.QueryContext) *elastic.SearchService {
	//build query using bool query
	equery := elastic.NewBoolQuery()
	if esQuery.Query != "" {
		equery = equery.Must(elastic.NewQueryStringQuery(esQuery.Query).AnalyzeWildcard(true))
	}
	equery = equery.Filter(elastic.NewRangeQuery(esQuery.TimeField).Format("epoch_millis").From(e.formatTimeRange(context.TimeRange.From)).To(e.formatTimeRange(context.TimeRange.To)))

	return searchService.Query(equery)
}

func (e *EsExecutor) buildAggregations(searchService *elastic.SearchService, esQuery EsQuery, context *tsdb.QueryContext) *elastic.SearchService {
	var aggretaionParent *elastic.DateHistogramAggregation
	var aggretaionTermParent *elastic.TermsAggregation

	// walk over it in dashboard order - histogram should be last
	for i := 0; i < len(esQuery.BucketAggs); i++ {
		bAgg := esQuery.BucketAggs[i]
		bucketAggregation := e.buildBucketAggregation(bAgg, context)
		if i == 0 {
			searchService.Aggregation(bAgg.Id, bucketAggregation)
		} else {
			aggretaionTermParent.SubAggregation(bAgg.Id, bucketAggregation)
		}

		terms, ok := bucketAggregation.(*elastic.TermsAggregation)
		if ok == true {
			aggretaionTermParent = terms
			continue
		}
		histogram, ok := bucketAggregation.(*elastic.DateHistogramAggregation)
		if ok == true {
			aggretaionParent = histogram
			continue
		}
	}

	// walk over it in dashboard order
	for i := 0; i < len(esQuery.Metrics); i++ {
		mAgg := esQuery.Metrics[i]
		metricAggregation := e.buildMetricAggregation(mAgg, context)
		if metricAggregation != nil {
			aggretaionParent.SubAggregation(mAgg.Id, metricAggregation)
		}
	}

	return searchService
}

func (e *EsExecutor) buildMetricAggregation(agg EsMetric, context *tsdb.QueryContext) elastic.Aggregation {
	var aggregation elastic.Aggregation

	var script *elastic.Script = nil
	if agg.InlineScript != "" {
		script = elastic.NewScriptInline(agg.InlineScript)
	}

	if agg.MetricType == "avg" {
		aggregation = elastic.NewAvgAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "sum" {
		aggregation = elastic.NewSumAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "min" {
		aggregation = elastic.NewMinAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "max" {
		aggregation = elastic.NewMaxAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "cardinality" {
		i, _ := strconv.ParseInt(agg.Settings.PrecisionThreshold, 10, 64)
		aggregation = elastic.NewCardinalityAggregation().Field(agg.Field).Script(script).PrecisionThreshold(i)
	} else if agg.MetricType == "percentiles" {
		var percentiles []float64
		for _, percentile := range agg.Settings.Percentiles {
			f, _ := strconv.ParseFloat(percentile, 10)
			percentiles = append(percentiles, f)
		}
		aggregation = elastic.NewPercentilesAggregation().Field(agg.Field).Script(script).Percentiles(percentiles...)
	} else if agg.MetricType == "extended_stats" {
		//TODO sigma?
		aggregation = elastic.NewExtendedStatsAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "count" {
		//return nil -> take doc_count instead of a sub query
		//aggregation = elastic.NewValueCountAggregation().Field(agg.Field).Script(script)
	} else if agg.MetricType == "derivative" {
		aggregation = elastic.NewDerivativeAggregation().BucketsPath(agg.Field)
	} else if agg.MetricType == "moving_avg" {
		//TODO change model
		aggregation = elastic.NewMovAvgAggregation().BucketsPath(agg.Field).Window(agg.Settings.Window)
	} else { //TODO add more
		fmt.Printf("Aggregation type currently not supported: %s\n", agg.MetricType)
	}

	return aggregation
}

func (e *EsExecutor) buildBucketAggregation(agg EsBucketAgg, context *tsdb.QueryContext) elastic.Aggregation {
	var aggregation elastic.Aggregation

	if agg.AggType == "date_histogram" {
		interval := "30s" //TODO get this from DB / dashboard settings
		if agg.Settings.Interval != "auto" {
			interval = agg.Settings.Interval
		}
		aggregation = elastic.NewDateHistogramAggregation().Field(agg.Field).Format("epoch_millis").ExtendedBounds(e.formatTimeRange(context.TimeRange.From), e.formatTimeRange(context.TimeRange.To)).Interval(interval).MinDocCount(agg.Settings.MinDocCount)
	} else if agg.AggType == "terms" {
		i, err := strconv.ParseInt(agg.Settings.Size, 10, 32)
		if err != nil {
			i = 20
		}
		aggregation = elastic.NewTermsAggregation().Field(agg.Field).Size(int(i))
	} else { //TODO add more
		fmt.Printf("Aggregation type currently not supported: %s\n", agg.AggType)
	}

	return aggregation
}

func (e *EsExecutor) formatTimeRange(input string) string {
	if input == "now" {
		//TODO we could return "now" but there is a issue with strange values for "derivative" aggs @now
		duration, _ := time.ParseDuration("-30s")
		return strconv.FormatInt(time.Now().Add(duration).UnixNano()/1000/1000, 10)
	}

	duration, err := time.ParseDuration("-" + input)
	if err != nil {
		fmt.Printf("Something failed on duration parsing %s\n", err)
	}

	return strconv.FormatInt(time.Now().Add(duration).UnixNano()/1000/1000, 10)
}
