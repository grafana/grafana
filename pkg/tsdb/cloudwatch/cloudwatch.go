package cloudwatch

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

type datasourceInfo struct {
	Profile       string
	Region        string
	AuthType      authType
	AssumeRoleARN string
	ExternalID    string
	Namespace     string

	AccessKey string
	SecretKey string
}

const cloudWatchTSFormat = "2006-01-02 15:04:05.000"
const defaultRegion = "default"

// Constants also defined in datasource/cloudwatch/datasource.ts
const logIdentifierInternal = "__log__grafana_internal__"
const logStreamIdentifierInternal = "__logstream__grafana_internal__"

var plog = log.New("tsdb.cloudwatch")
var aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", func(ds *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return newExecutor(), nil
	})
}

func newExecutor() *cloudWatchExecutor {
	return &cloudWatchExecutor{
		logsClientsByRegion: map[string]cloudwatchlogsiface.CloudWatchLogsAPI{},
	}
}

// cloudWatchExecutor executes CloudWatch requests.
type cloudWatchExecutor struct {
	*models.DataSource

	ec2Client           ec2iface.EC2API
	rgtaClient          resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
	logsClientsByRegion map[string]cloudwatchlogsiface.CloudWatchLogsAPI
	mtx                 sync.Mutex
}

func (e *cloudWatchExecutor) newSession(region string) (*session.Session, error) {
	dsInfo := e.getDSInfo(region)

	bldr := strings.Builder{}
	for i, s := range []string{
		dsInfo.AuthType.String(), dsInfo.AccessKey, dsInfo.Profile, dsInfo.AssumeRoleARN, region,
	} {
		if i != 0 {
			bldr.WriteString(":")
		}
		bldr.WriteString(strings.ReplaceAll(s, ":", `\:`))
	}
	cacheKey := bldr.String()

	sessCacheLock.RLock()
	if env, ok := sessCache[cacheKey]; ok {
		if env.expiration.After(time.Now().UTC()) {
			sessCacheLock.RUnlock()
			return env.session, nil
		}
	}
	sessCacheLock.RUnlock()

	cfgs := []*aws.Config{
		{
			CredentialsChainVerboseErrors: aws.Bool(true),
		},
	}

	var regionCfg *aws.Config
	if dsInfo.Region == defaultRegion {
		plog.Warn("Region is set to \"default\", which is unsupported")
		dsInfo.Region = ""
	}
	if dsInfo.Region != "" {
		regionCfg = &aws.Config{Region: aws.String(dsInfo.Region)}
		cfgs = append(cfgs, regionCfg)
	}

	switch dsInfo.AuthType {
	case authTypeSharedCreds:
		plog.Debug("Authenticating towards AWS with shared credentials", "profile", dsInfo.Profile,
			"region", dsInfo.Region)
		cfgs = append(cfgs, &aws.Config{
			Credentials: credentials.NewSharedCredentials("", dsInfo.Profile),
		})
	case authTypeKeys:
		plog.Debug("Authenticating towards AWS with an access key pair", "region", dsInfo.Region)
		cfgs = append(cfgs, &aws.Config{
			Credentials: credentials.NewStaticCredentials(dsInfo.AccessKey, dsInfo.SecretKey, ""),
		})
	case authTypeDefault:
		plog.Debug("Authenticating towards AWS with default SDK method", "region", dsInfo.Region)
	default:
		panic(fmt.Sprintf("Unrecognized authType: %d", dsInfo.AuthType))
	}
	sess, err := newSession(cfgs...)
	if err != nil {
		return nil, err
	}

	duration := stscreds.DefaultDuration
	expiration := time.Now().Add(duration)
	if dsInfo.AssumeRoleARN != "" {
		// We should assume a role in AWS
		plog.Debug("Trying to assume role in AWS", "arn", dsInfo.AssumeRoleARN)

		cfgs := []*aws.Config{
			{
				CredentialsChainVerboseErrors: aws.Bool(true),
			},
			{
				Credentials: newSTSCredentials(sess, dsInfo.AssumeRoleARN, func(p *stscreds.AssumeRoleProvider) {
					// Not sure if this is necessary, overlaps with p.Duration and is undocumented
					p.Expiry.SetExpiration(expiration, 0)
					p.Duration = duration
					if dsInfo.ExternalID != "" {
						p.ExternalID = aws.String(dsInfo.ExternalID)
					}
				}),
			},
		}
		if regionCfg != nil {
			cfgs = append(cfgs, regionCfg)
		}
		sess, err = newSession(cfgs...)
		if err != nil {
			return nil, err
		}
	}

	plog.Debug("Successfully created AWS session")

	sessCacheLock.Lock()
	sessCache[cacheKey] = envelope{
		session:    sess,
		expiration: expiration,
	}
	sessCacheLock.Unlock()

	return sess, nil
}

func (e *cloudWatchExecutor) getCWClient(region string) (cloudwatchiface.CloudWatchAPI, error) {
	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	return newCWClient(sess), nil
}

func (e *cloudWatchExecutor) getCWLogsClient(region string) (cloudwatchlogsiface.CloudWatchLogsAPI, error) {
	e.mtx.Lock()
	defer e.mtx.Unlock()

	if logsClient, ok := e.logsClientsByRegion[region]; ok {
		return logsClient, nil
	}

	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}

	logsClient := newCWLogsClient(sess)
	e.logsClientsByRegion[region] = logsClient

	return logsClient, nil
}

func (e *cloudWatchExecutor) getEC2Client(region string) (ec2iface.EC2API, error) {
	if e.ec2Client != nil {
		return e.ec2Client, nil
	}

	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	e.ec2Client = newEC2Client(sess)

	return e.ec2Client, nil
}

func (e *cloudWatchExecutor) getRGTAClient(region string) (resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI,
	error) {
	if e.rgtaClient != nil {
		return e.rgtaClient, nil
	}

	sess, err := e.newSession(region)
	if err != nil {
		return nil, err
	}
	e.rgtaClient = newRGTAClient(sess)

	return e.rgtaClient, nil
}

func (e *cloudWatchExecutor) alertQuery(ctx context.Context, logsClient cloudwatchlogsiface.CloudWatchLogsAPI,
	queryContext *tsdb.TsdbQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	const maxAttempts = 8
	const pollPeriod = 1000 * time.Millisecond

	queryParams := queryContext.Queries[0].Model
	startQueryOutput, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	requestParams := simplejson.NewFromAny(map[string]interface{}{
		"region":  queryParams.Get("region").MustString(""),
		"queryId": *startQueryOutput.QueryId,
	})

	ticker := time.NewTicker(pollPeriod)
	defer ticker.Stop()

	attemptCount := 1
	for range ticker.C {
		res, err := e.executeGetQueryResults(ctx, logsClient, requestParams)
		if err != nil {
			return nil, err
		}
		if isTerminated(*res.Status) {
			return res, err
		}
		if attemptCount >= maxAttempts {
			return res, fmt.Errorf("fetching of query results exceeded max number of attempts")
		}

		attemptCount++
	}

	return nil, nil
}

// Query executes a CloudWatch query.
func (e *cloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	e.DataSource = dsInfo

	/*
		Unlike many other data sources,	with Cloudwatch Logs query requests don't receive the results as the response to the query, but rather
		an ID is first returned. Following this, a client is expected to send requests along with the ID until the status of the query is complete,
		receiving (possibly partial) results each time. For queries made via dashboards and Explore, the logic of making these repeated queries is handled on
		the frontend, but because alerts are executed on the backend the logic needs to be reimplemented here.
	*/
	queryParams := queryContext.Queries[0].Model
	_, fromAlert := queryContext.Headers["FromAlert"]
	isLogAlertQuery := fromAlert && queryParams.Get("queryMode").MustString("") == "Logs"

	if isLogAlertQuery {
		return e.executeLogAlertQuery(ctx, queryContext)
	}

	queryType := queryParams.Get("type").MustString("")

	var err error
	var result *tsdb.Response
	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "logAction":
		result, err = e.executeLogActions(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *cloudWatchExecutor) executeLogAlertQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	queryParams := queryContext.Queries[0].Model
	queryParams.Set("subtype", "StartQuery")
	queryParams.Set("queryString", queryParams.Get("expression").MustString(""))

	region := queryParams.Get("region").MustString(defaultRegion)
	if region == defaultRegion {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
		queryParams.Set("region", region)
	}

	logsClient, err := e.getCWLogsClient(region)
	if err != nil {
		return nil, err
	}

	result, err := e.executeStartQuery(ctx, logsClient, queryParams, queryContext.TimeRange)
	if err != nil {
		return nil, err
	}

	queryParams.Set("queryId", *result.QueryId)

	// Get query results
	getQueryResultsOutput, err := e.alertQuery(ctx, logsClient, queryContext)
	if err != nil {
		return nil, err
	}

	dataframe, err := logsResultsToDataframes(getQueryResultsOutput)
	if err != nil {
		return nil, err
	}

	statsGroups := queryParams.Get("statsGroups").MustStringArray()
	if len(statsGroups) > 0 && len(dataframe.Fields) > 0 {
		groupedFrames, err := groupResults(dataframe, statsGroups)
		if err != nil {
			return nil, err
		}

		response := &tsdb.Response{
			Results: make(map[string]*tsdb.QueryResult),
		}

		response.Results["A"] = &tsdb.QueryResult{
			RefId:      "A",
			Dataframes: tsdb.NewDecodedDataFrames(groupedFrames),
		}

		return response, nil
	}

	response := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"A": {
				RefId:      "A",
				Dataframes: tsdb.NewDecodedDataFrames(data.Frames{dataframe}),
			},
		},
	}
	return response, nil
}

type authType int

const (
	authTypeDefault authType = iota
	authTypeSharedCreds
	authTypeKeys
)

func (at authType) String() string {
	switch at {
	case authTypeDefault:
		return "default"
	case authTypeSharedCreds:
		return "sharedCreds"
	case authTypeKeys:
		return "keys"
	default:
		panic(fmt.Sprintf("Unrecognized auth type %d", at))
	}
}

func (e *cloudWatchExecutor) getDSInfo(region string) *datasourceInfo {
	if region == defaultRegion {
		region = e.DataSource.JsonData.Get("defaultRegion").MustString()
	}

	atStr := e.DataSource.JsonData.Get("authType").MustString()
	assumeRoleARN := e.DataSource.JsonData.Get("assumeRoleArn").MustString()
	externalID := e.DataSource.JsonData.Get("externalId").MustString()
	decrypted := e.DataSource.DecryptedValues()
	accessKey := decrypted["accessKey"]
	secretKey := decrypted["secretKey"]

	at := authTypeDefault
	switch atStr {
	case "credentials":
		at = authTypeSharedCreds
	case "keys":
		at = authTypeKeys
	case "default":
		at = authTypeDefault
	case "arn":
		at = authTypeDefault
		plog.Warn("Authentication type \"arn\" is deprecated, falling back to default")
	default:
		plog.Warn("Unrecognized AWS authentication type", "type", atStr)
	}

	profile := e.DataSource.JsonData.Get("profile").MustString()
	if profile == "" {
		profile = e.DataSource.Database // legacy support
	}

	return &datasourceInfo{
		Region:        region,
		Profile:       profile,
		AuthType:      at,
		AssumeRoleARN: assumeRoleARN,
		ExternalID:    externalID,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
	}
}

func isTerminated(queryStatus string) bool {
	return queryStatus == "Complete" || queryStatus == "Cancelled" || queryStatus == "Failed" || queryStatus == "Timeout"
}

// CloudWatch client factory.
//
// Stubbable by tests.
var newCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
	client := cloudwatch.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client
}

// CloudWatch logs client factory.
//
// Stubbable by tests.
var newCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
	client := cloudwatchlogs.New(sess)
	client.Handlers.Send.PushFront(func(r *request.Request) {
		r.HTTPRequest.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	})

	return client
}

// EC2 client factory.
//
// Stubbable by tests.
var newEC2Client = func(provider client.ConfigProvider) ec2iface.EC2API {
	return ec2.New(provider)
}

// RGTA client factory.
//
// Stubbable by tests.
var newRGTAClient = func(provider client.ConfigProvider) resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI {
	return resourcegroupstaggingapi.New(provider)
}
