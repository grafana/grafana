package cloudwatch

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

type actionHandler func(*cwRequest, *middleware.Context)

var actionHandlers map[string]actionHandler

type cwRequest struct {
	Region     string `json:"region"`
	Action     string `json:"action"`
	Body       []byte `json:"-"`
	DataSource *m.DataSource
}

type datasourceInfo struct {
	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func (req *cwRequest) GetDatasourceInfo() *datasourceInfo {
	authType := req.DataSource.JsonData.Get("authType").MustString()
	assumeRoleArn := req.DataSource.JsonData.Get("assumeRoleArn").MustString()
	accessKey := ""
	secretKey := ""

	for key, value := range req.DataSource.SecureJsonData.Decrypt() {
		if key == "accessKey" {
			accessKey = value
		}
		if key == "secretKey" {
			secretKey = value
		}
	}

	return &datasourceInfo{
		AuthType:      authType,
		AssumeRoleArn: assumeRoleArn,
		Region:        req.Region,
		Profile:       req.DataSource.Database,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
	}
}

func init() {
	actionHandlers = map[string]actionHandler{
		"GetMetricStatistics":     handleGetMetricStatistics,
		"ListMetrics":             handleListMetrics,
		"DescribeAlarms":          handleDescribeAlarms,
		"DescribeAlarmsForMetric": handleDescribeAlarmsForMetric,
		"DescribeAlarmHistory":    handleDescribeAlarmHistory,
		"DescribeInstances":       handleDescribeInstances,
		"__GetRegions":            handleGetRegions,
		"__GetNamespaces":         handleGetNamespaces,
		"__GetMetrics":            handleGetMetrics,
		"__GetDimensions":         handleGetDimensions,
	}
}

type cache struct {
	credential *credentials.Credentials
	expiration *time.Time
}

var awsCredentialCache map[string]cache = make(map[string]cache)
var credentialCacheLock sync.RWMutex

func getCredentials(dsInfo *datasourceInfo) (*credentials.Credentials, error) {
	cacheKey := dsInfo.Profile + ":" + dsInfo.AssumeRoleArn
	credentialCacheLock.RLock()
	if _, ok := awsCredentialCache[cacheKey]; ok {
		if awsCredentialCache[cacheKey].expiration != nil &&
			(*awsCredentialCache[cacheKey].expiration).After(time.Now().UTC()) {
			result := awsCredentialCache[cacheKey].credential
			credentialCacheLock.RUnlock()
			return result, nil
		}
	}
	credentialCacheLock.RUnlock()

	accessKeyId := ""
	secretAccessKey := ""
	sessionToken := ""
	var expiration *time.Time
	expiration = nil
	if dsInfo.AuthType == "arn" && strings.Index(dsInfo.AssumeRoleArn, "arn:aws:iam:") == 0 {
		params := &sts.AssumeRoleInput{
			RoleArn:         aws.String(dsInfo.AssumeRoleArn),
			RoleSessionName: aws.String("GrafanaSession"),
			DurationSeconds: aws.Int64(900),
		}

		stsSess, err := session.NewSession()
		if err != nil {
			return nil, err
		}
		stsCreds := credentials.NewChainCredentials(
			[]credentials.Provider{
				&credentials.EnvProvider{},
				&credentials.SharedCredentialsProvider{Filename: "", Profile: dsInfo.Profile},
				remoteCredProvider(stsSess),
			})
		stsConfig := &aws.Config{
			Region:      aws.String(dsInfo.Region),
			Credentials: stsCreds,
		}

		sess, err := session.NewSession(stsConfig)
		if err != nil {
			return nil, err
		}
		svc := sts.New(sess, stsConfig)
		resp, err := svc.AssumeRole(params)
		if err != nil {
			return nil, err
		}
		if resp.Credentials != nil {
			accessKeyId = *resp.Credentials.AccessKeyId
			secretAccessKey = *resp.Credentials.SecretAccessKey
			sessionToken = *resp.Credentials.SessionToken
			expiration = resp.Credentials.Expiration
		}
	}

	sess, err := session.NewSession()
	if err != nil {
		return nil, err
	}
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     accessKeyId,
				SecretAccessKey: secretAccessKey,
				SessionToken:    sessionToken,
			}},
			&credentials.EnvProvider{},
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     dsInfo.AccessKey,
				SecretAccessKey: dsInfo.SecretKey,
			}},
			&credentials.SharedCredentialsProvider{Filename: "", Profile: dsInfo.Profile},
			remoteCredProvider(sess),
		})

	credentialCacheLock.Lock()
	awsCredentialCache[cacheKey] = cache{
		credential: creds,
		expiration: expiration,
	}
	credentialCacheLock.Unlock()

	return creds, nil
}

func remoteCredProvider(sess *session.Session) credentials.Provider {
	ecsCredURI := os.Getenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI")

	if len(ecsCredURI) > 0 {
		return ecsCredProvider(sess, ecsCredURI)
	}
	return ec2RoleProvider(sess)
}

func ecsCredProvider(sess *session.Session, uri string) credentials.Provider {
	const host = `169.254.170.2`

	c := ec2metadata.New(sess)
	return endpointcreds.NewProviderClient(
		c.Client.Config,
		c.Client.Handlers,
		fmt.Sprintf("http://%s%s", host, uri),
		func(p *endpointcreds.Provider) { p.ExpiryWindow = 5 * time.Minute })
}

func ec2RoleProvider(sess *session.Session) credentials.Provider {
	return &ec2rolecreds.EC2RoleProvider{Client: ec2metadata.New(sess), ExpiryWindow: 5 * time.Minute}
}

func getAwsConfig(req *cwRequest) (*aws.Config, error) {
	creds, err := getCredentials(req.GetDatasourceInfo())
	if err != nil {
		return nil, err
	}

	cfg := &aws.Config{
		Region:      aws.String(req.Region),
		Credentials: creds,
	}
	return cfg, nil
}

func handleGetMetricStatistics(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := cloudwatch.New(sess, cfg)

	reqParam := &struct {
		Parameters struct {
			Namespace          string                  `json:"namespace"`
			MetricName         string                  `json:"metricName"`
			Dimensions         []*cloudwatch.Dimension `json:"dimensions"`
			Statistics         []*string               `json:"statistics"`
			ExtendedStatistics []*string               `json:"extendedStatistics"`
			StartTime          int64                   `json:"startTime"`
			EndTime            int64                   `json:"endTime"`
			Period             int64                   `json:"period"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.GetMetricStatisticsInput{
		Namespace:  aws.String(reqParam.Parameters.Namespace),
		MetricName: aws.String(reqParam.Parameters.MetricName),
		Dimensions: reqParam.Parameters.Dimensions,
		StartTime:  aws.Time(time.Unix(reqParam.Parameters.StartTime, 0)),
		EndTime:    aws.Time(time.Unix(reqParam.Parameters.EndTime, 0)),
		Period:     aws.Int64(reqParam.Parameters.Period),
	}
	if len(reqParam.Parameters.Statistics) != 0 {
		params.Statistics = reqParam.Parameters.Statistics
	}
	if len(reqParam.Parameters.ExtendedStatistics) != 0 {
		params.ExtendedStatistics = reqParam.Parameters.ExtendedStatistics
	}

	resp, err := svc.GetMetricStatistics(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	metrics.M_Aws_CloudWatch_GetMetricStatistics.Inc()

	c.JSON(200, resp)
}

func handleListMetrics(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := cloudwatch.New(sess, cfg)

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

	var resp cloudwatch.ListMetricsOutput
	err = svc.ListMetricsPages(params,
		func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
			metrics.M_Aws_CloudWatch_ListMetrics.Inc()
			metrics, _ := awsutil.ValuesAtPath(page, "Metrics")
			for _, metric := range metrics {
				resp.Metrics = append(resp.Metrics, metric.(*cloudwatch.Metric))
			}
			return !lastPage
		})
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleDescribeAlarms(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := cloudwatch.New(sess, cfg)

	reqParam := &struct {
		Parameters struct {
			ActionPrefix    string    `json:"actionPrefix"`
			AlarmNamePrefix string    `json:"alarmNamePrefix"`
			AlarmNames      []*string `json:"alarmNames"`
			StateValue      string    `json:"stateValue"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.DescribeAlarmsInput{
		MaxRecords: aws.Int64(100),
	}
	if reqParam.Parameters.ActionPrefix != "" {
		params.ActionPrefix = aws.String(reqParam.Parameters.ActionPrefix)
	}
	if reqParam.Parameters.AlarmNamePrefix != "" {
		params.AlarmNamePrefix = aws.String(reqParam.Parameters.AlarmNamePrefix)
	}
	if len(reqParam.Parameters.AlarmNames) != 0 {
		params.AlarmNames = reqParam.Parameters.AlarmNames
	}
	if reqParam.Parameters.StateValue != "" {
		params.StateValue = aws.String(reqParam.Parameters.StateValue)
	}

	resp, err := svc.DescribeAlarms(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleDescribeAlarmsForMetric(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := cloudwatch.New(sess, cfg)

	reqParam := &struct {
		Parameters struct {
			Namespace         string                  `json:"namespace"`
			MetricName        string                  `json:"metricName"`
			Dimensions        []*cloudwatch.Dimension `json:"dimensions"`
			Statistic         string                  `json:"statistic"`
			ExtendedStatistic string                  `json:"extendedStatistic"`
			Period            int64                   `json:"period"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.DescribeAlarmsForMetricInput{
		Namespace:  aws.String(reqParam.Parameters.Namespace),
		MetricName: aws.String(reqParam.Parameters.MetricName),
		Period:     aws.Int64(reqParam.Parameters.Period),
	}
	if len(reqParam.Parameters.Dimensions) != 0 {
		params.Dimensions = reqParam.Parameters.Dimensions
	}
	if reqParam.Parameters.Statistic != "" {
		params.Statistic = aws.String(reqParam.Parameters.Statistic)
	}
	if reqParam.Parameters.ExtendedStatistic != "" {
		params.ExtendedStatistic = aws.String(reqParam.Parameters.ExtendedStatistic)
	}

	resp, err := svc.DescribeAlarmsForMetric(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleDescribeAlarmHistory(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := cloudwatch.New(sess, cfg)

	reqParam := &struct {
		Parameters struct {
			AlarmName       string `json:"alarmName"`
			HistoryItemType string `json:"historyItemType"`
			StartDate       int64  `json:"startDate"`
			EndDate         int64  `json:"endDate"`
		} `json:"parameters"`
	}{}
	json.Unmarshal(req.Body, reqParam)

	params := &cloudwatch.DescribeAlarmHistoryInput{
		AlarmName: aws.String(reqParam.Parameters.AlarmName),
		StartDate: aws.Time(time.Unix(reqParam.Parameters.StartDate, 0)),
		EndDate:   aws.Time(time.Unix(reqParam.Parameters.EndDate, 0)),
	}
	if reqParam.Parameters.HistoryItemType != "" {
		params.HistoryItemType = aws.String(reqParam.Parameters.HistoryItemType)
	}

	resp, err := svc.DescribeAlarmHistory(params)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}

	c.JSON(200, resp)
}

func handleDescribeInstances(req *cwRequest, c *middleware.Context) {
	cfg, err := getAwsConfig(req)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	sess, err := session.NewSession(cfg)
	if err != nil {
		c.JsonApiErr(500, "Unable to call AWS API", err)
		return
	}
	svc := ec2.New(sess, cfg)

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

	var resp ec2.DescribeInstancesOutput
	err = svc.DescribeInstancesPages(params,
		func(page *ec2.DescribeInstancesOutput, lastPage bool) bool {
			reservations, _ := awsutil.ValuesAtPath(page, "Reservations")
			for _, reservation := range reservations {
				resp.Reservations = append(resp.Reservations, reservation.(*ec2.Reservation))
			}
			return !lastPage
		})
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
