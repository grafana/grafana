package cloudwatch

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/Cepave/grafana/pkg/middleware"
)

type actionHandler func(*cwRequest, *middleware.Context)

var actionHandlers map[string]actionHandler

type cwRequest struct {
	Region     string `json:"region"`
	Action     string `json:"action"`
	Body       []byte `json:"-"`
	DataSource *m.DataSource
}

func init() {
	actionHandlers = map[string]actionHandler{
		"GetMetricStatistics": handleGetMetricStatistics,
		"ListMetrics":         handleListMetrics,
		"DescribeInstances":   handleDescribeInstances,
		"__GetRegions":        handleGetRegions,
		"__GetNamespaces":     handleGetNamespaces,
		"__GetMetrics":        handleGetMetrics,
		"__GetDimensions":     handleGetDimensions,
	}
}

func handleGetMetricStatistics(req *cwRequest, c *middleware.Context) {
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.EnvProvider{},
			&credentials.SharedCredentialsProvider{Filename: "", Profile: req.DataSource.Database},
			&ec2rolecreds.EC2RoleProvider{ExpiryWindow: 5 * time.Minute},
		})
	svc := cloudwatch.New(&aws.Config{
		Region:      aws.String(req.Region),
		Credentials: creds,
	})

	reqParam := &struct {
		Parameters struct {
			Namespace  string                  `json:"namespace"`
			MetricName string                  `json:"metricName"`
			Dimensions []*cloudwatch.Dimension `json:"dimensions"`
			Statistics []*string               `json:"statistics"`
			StartTime  int64                   `json:"startTime"`
			EndTime    int64                   `json:"endTime"`
			Period     int64                   `json:"period"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.GetMetricStatisticsInput{
		Namespace:  aws.String(reqParam.Parameters.Namespace),
		MetricName: aws.String(reqParam.Parameters.MetricName),
		Dimensions: reqParam.Parameters.Dimensions,
		Statistics: reqParam.Parameters.Statistics,
		StartTime:  aws.Time(time.Unix(reqParam.Parameters.StartTime, 0)),
		EndTime:    aws.Time(time.Unix(reqParam.Parameters.EndTime, 0)),
		Period:     aws.Int64(reqParam.Parameters.Period),
	}

	resp, err := svc.GetMetricStatistics(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleListMetrics(req *cwRequest, c *middleware.Context) {
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.EnvProvider{},
			&credentials.SharedCredentialsProvider{Filename: "", Profile: req.DataSource.Database},
			&ec2rolecreds.EC2RoleProvider{ExpiryWindow: 5 * time.Minute},
		})
	svc := cloudwatch.New(&aws.Config{
		Region:      aws.String(req.Region),
		Credentials: creds,
	})

	reqParam := &struct {
		Parameters struct {
			Namespace  string                        `json:"namespace"`
			MetricName string                        `json:"metricName"`
			Dimensions []*cloudwatch.DimensionFilter `json:"dimensions"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(reqParam.Parameters.Namespace),
		MetricName: aws.String(reqParam.Parameters.MetricName),
		Dimensions: reqParam.Parameters.Dimensions,
	}

	resp, err := svc.ListMetrics(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleDescribeInstances(req *cwRequest, c *middleware.Context) {
	svc := ec2.New(&aws.Config{Region: aws.String(req.Region)})

	reqParam := &struct {
		Parameters struct {
			Filters     []*ec2.Filter `json:"filters"`
			InstanceIds []*string     `json:"instanceIds"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &ec2.DescribeInstancesInput{}
	if len(reqParam.Parameters.Filters) > 0 {
		params.Filters = reqParam.Parameters.Filters
	}
	if len(reqParam.Parameters.InstanceIds) > 0 {
		params.InstanceIds = reqParam.Parameters.InstanceIds
	}

	resp, err := svc.DescribeInstances(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func HandleRequest(c *middleware.Context, ds *m.DataSource) {
	var req cwRequest
	req.Body, _ = ioutil.ReadAll(c.Req.Request.Body)
	req.DataSource = ds
	json.Unmarshal(req.Body, &req)

	if handler, found := actionHandlers[req.Action]; !found {
		c.JsonApiErr(500, "Unexpected AWS Action", errors.New(req.Action))
		return
	} else {
		handler(&req, c)
	}
}
