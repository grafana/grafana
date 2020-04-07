package cloudwatch

import (
	"context"
	"fmt"
	"regexp"

	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type CloudWatchExecutor struct {
	*models.DataSource
}

type DatasourceInfo struct {
	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &CloudWatchExecutor{}, nil
}

var (
	plog        log.Logger
	aliasFormat *regexp.Regexp
)

func init() {
	plog = log.New("tsdb.cloudwatch")
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", NewCloudWatchExecutor)
	aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
}

func (e *CloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	e.DataSource = dsInfo
	queryType := queryContext.Queries[0].Model.Get("type").MustString("")
	var err error

	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *CloudWatchExecutor) getDsInfo(region string) *DatasourceInfo {
	defaultRegion := e.DataSource.JsonData.Get("defaultRegion").MustString()
	if region == "default" {
		region = defaultRegion
	}

	authType := e.DataSource.JsonData.Get("authType").MustString()
	assumeRoleArn := e.DataSource.JsonData.Get("assumeRoleArn").MustString()
	decrypted := e.DataSource.DecryptedValues()
	accessKey := decrypted["accessKey"]
	secretKey := decrypted["secretKey"]

	datasourceInfo := &DatasourceInfo{
		Region:        region,
		Profile:       e.DataSource.Database,
		AuthType:      authType,
		AssumeRoleArn: assumeRoleArn,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
	}

	return datasourceInfo
}

func (e *CloudWatchExecutor) getCloudWatchClient(region string) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := globalSessionCache.Get(e.getDsInfo(region))
	if err != nil {
		return nil, err
	}

	client := cloudwatch.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})
	return client, nil
}

func (e *CloudWatchExecutor) getEc2Client(region string) (ec2iface.EC2API, error) {
	sess, err := globalSessionCache.Get(e.getDsInfo(region))
	if err != nil {
		return nil, err
	}

	client := ec2.New(sess)
	return client, nil
}

func (e *CloudWatchExecutor) getRgtaClient(region string) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI, error) {
	sess, err := globalSessionCache.Get(e.getDsInfo(region))
	if err != nil {
		return nil, err
	}

	client := resourcegroupstaggingapi.New(sess)
	return client, nil
}
