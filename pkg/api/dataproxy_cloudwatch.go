package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/middleware"
)

func ProxyCloudWatchDataSourceRequest(c *middleware.Context) {
	body, _ := ioutil.ReadAll(c.Req.Request.Body)

	reqInfo := &struct {
		Region  string `json:"region"`
		Service string `json:"service"`
		Action  string `json:"action"`
	}{}
	json.Unmarshal([]byte(body), reqInfo)

	svc := cloudwatch.New(&aws.Config{Region: aws.String(reqInfo.Region)})

	switch reqInfo.Action {
	case "GetMetricStatistics":
		reqParam := &struct {
			Parameters struct {
				Namespace  string              `json:"Namespace"`
				MetricName string              `json:"MetricName"`
				Dimensions []map[string]string `json:"Dimensions"`
				Statistics []string            `json:"Statistics"`
				StartTime  int64               `json:"StartTime"`
				EndTime    int64               `json:"EndTime"`
				Period     int64               `json:"Period"`
			} `json:"parameters"`
		}{}
		json.Unmarshal([]byte(body), reqParam)

		statistics := make([]*string, 0)
		for k := range reqParam.Parameters.Statistics {
			statistics = append(statistics, &reqParam.Parameters.Statistics[k])
		}
		dimensions := make([]*cloudwatch.Dimension, 0)
		for _, d := range reqParam.Parameters.Dimensions {
			dimensions = append(dimensions, &cloudwatch.Dimension{
				Name:  aws.String(d["Name"]),
				Value: aws.String(d["Value"]),
			})
		}

		params := &cloudwatch.GetMetricStatisticsInput{
			Namespace:  aws.String(reqParam.Parameters.Namespace),
			MetricName: aws.String(reqParam.Parameters.MetricName),
			Dimensions: dimensions,
			Statistics: statistics,
			StartTime:  aws.Time(time.Unix(reqParam.Parameters.StartTime, 0)),
			EndTime:    aws.Time(time.Unix(reqParam.Parameters.EndTime, 0)),
			Period:     aws.Int64(reqParam.Parameters.Period),
		}

		resp, err := svc.GetMetricStatistics(params)
		if err != nil {
			c.JsonApiErr(500, "Unable to call AWS API", err)
			return
		}

		respJson, _ := json.Marshal(resp)
		fmt.Fprint(c.RW(), string(respJson))
	case "ListMetrics":
		reqParam := &struct {
			Parameters struct {
				Namespace  string              `json:"Namespace"`
				MetricName string              `json:"MetricName"`
				Dimensions []map[string]string `json:"Dimensions"`
			} `json:"parameters"`
		}{}
		json.Unmarshal([]byte(body), reqParam)

		dimensions := make([]*cloudwatch.DimensionFilter, 0)
		for _, d := range reqParam.Parameters.Dimensions {
			dimensions = append(dimensions, &cloudwatch.DimensionFilter{
				Name:  aws.String(d["Name"]),
				Value: aws.String(d["Value"]),
			})
		}

		params := &cloudwatch.ListMetricsInput{
			Namespace:  aws.String(reqParam.Parameters.Namespace),
			MetricName: aws.String(reqParam.Parameters.MetricName),
			Dimensions: dimensions,
		}

		resp, err := svc.ListMetrics(params)
		if err != nil {
			c.JsonApiErr(500, "Unable to call AWS API", err)
			return
		}

		respJson, _ := json.Marshal(resp)
		fmt.Fprint(c.RW(), string(respJson))
	default:
		c.JsonApiErr(500, "Unexpected CloudWatch action", errors.New(reqInfo.Action))
	}
}
