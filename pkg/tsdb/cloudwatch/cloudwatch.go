package cloudwatch

import (
	"context"
	"regexp"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

var (
	// In order to properly cache sessions per-datasource we need to
	// keep a state for each datasource.
	executors    = make(map[int64]*CloudWatchExecutor)
	executorLock = sync.Mutex{}
)

type CloudWatchExecutor struct {
	*models.DataSource

	// clients is our interface to access AWS service-specific API clients
	clients clientCache

	// We cache custom metrics and dimensions on a per-datasource per-version basis
	// These are of type (profile -> region -> namespace)
	customMetricsMetricsMap    map[string]map[string]map[string]*CustomMetricsCache
	metricsCacheLock           sync.Mutex
	customMetricsDimensionsMap map[string]map[string]map[string]*CustomMetricsCache
	dimensionsCacheLock        sync.Mutex
}

func getExecutor(dsInfo *models.DataSource) *CloudWatchExecutor {
	executorLock.Lock()
	defer executorLock.Unlock()

	// If the version has been updated we want to break the cache
	if exec := executors[dsInfo.Id]; exec != nil && exec.DataSource.Version >= dsInfo.Version {
		return exec
	}

	exec := &CloudWatchExecutor{
		DataSource:                 dsInfo,
		clients:                    newSessionCache(),
		customMetricsMetricsMap:    make(map[string]map[string]map[string]*CustomMetricsCache),
		customMetricsDimensionsMap: make(map[string]map[string]map[string]*CustomMetricsCache),
	}

	executors[dsInfo.Id] = exec
	return exec
}

type DatasourceInfo struct {
	Id int64

	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return getExecutor(dsInfo), nil
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
		Id:            e.DataSource.Id,
		Region:        region,
		Profile:       e.DataSource.Database,
		AuthType:      authType,
		AssumeRoleArn: assumeRoleArn,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
	}

	return datasourceInfo
}
