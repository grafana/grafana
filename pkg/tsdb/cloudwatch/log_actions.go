package cloudwatch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	"github.com/aws/smithy-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

const (
	defaultEventLimit           = int32(10)
	defaultLogGroupLimit        = int32(50)
	logIdentifierInternal       = "__log__grafana_internal__"
	logStreamIdentifierInternal = "__logstream__grafana_internal__"
	logGroupsMacro              = "$__logGroups"
	sourceMacro                 = "$__source"

	// Only for CWLI queries.
	// The fields @log and @logStream are always included in the results of a user's query
	// so that a row's context can be retrieved later if necessary.
	// The usage of ltrim around the @log/@logStream fields is a necessary workaround, as without it,
	// CloudWatch wouldn't consider a query using a non-aliased @log/@logStream valid.
	logContextFieldsClause = "fields @timestamp,ltrim(@log) as " + logIdentifierInternal + ",ltrim(@logStream) as " + logStreamIdentifierInternal

	// SOURCE command limits as defined by AWS CloudWatch Logs Insights
	// See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax-Source.html
	maxSourceLogGroupPrefixes   = 5
	minSourceLogGroupPrefixLen  = 3
	maxSourceAccountIdentifiers = 20
	maxDataSourceSelections     = 10
)

var sourceCommandRegex = regexp.MustCompile(`(?i)^\s*source\s+`)
var pplSourceCommandRegex = regexp.MustCompile(`(?im)(^|\|)\s*(--[^\n]*(\n|$)\s*)*(search\s+)?source\s*=`)
var dataSourceIdentifierPartRegex = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

type AWSError struct {
	Code    string
	Message string
	Payload map[string]string
}

type startQueryPlan struct {
	queryString string
	// useStartQueryInputLogGroups controls whether executeStartQuery should populate
	// StartQueryInput.LogGroupNames / LogGroupIdentifiers. Queries that keep all log
	// group selection inside the query text, such as SOURCE-injected CWLI scopes and
	// SQL/PPL source syntax, leave this false.
	useStartQueryInputLogGroups bool
}

func (e *AWSError) Error() string {
	return fmt.Sprintf("CloudWatch error: %s: %s", e.Code, e.Message)
}

func (ds *DataSource) executeLogActions(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	resultChan := make(chan backend.Responses, len(req.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	for _, query := range req.Queries {
		var logsQuery models.LogsQuery
		err := json.Unmarshal(query.JSON, &logsQuery)
		if err != nil {
			return nil, err
		}

		query := query
		eg.Go(func() error {
			dataframe, err := ds.executeLogAction(ectx, logsQuery, query)
			if err != nil {
				resultChan <- backend.Responses{
					query.RefID: backend.ErrorResponseWithErrorSource(err),
				}
				return nil
			}

			groupedFrames, err := groupResponseFrame(dataframe, logsQuery.StatsGroups)
			if err != nil {
				return err
			}
			resultChan <- backend.Responses{
				query.RefID: backend.DataResponse{Frames: groupedFrames},
			}
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		return nil, err
	}

	close(resultChan)

	for result := range resultChan {
		for refID, response := range result {
			respD := resp.Responses[refID]
			respD.Frames = response.Frames
			respD.Error = response.Error
			respD.ErrorSource = response.ErrorSource
			resp.Responses[refID] = respD
		}
	}

	return resp, nil
}

func (ds *DataSource) executeLogAction(ctx context.Context, logsQuery models.LogsQuery, query backend.DataQuery) (*data.Frame, error) {
	region := ds.Settings.Region
	if logsQuery.Region != "" {
		region = logsQuery.Region
	}

	logsClient, err := ds.getCWLogsClient(ctx, region)
	if err != nil {
		return nil, err
	}

	var frame *data.Frame
	switch logsQuery.Subtype {
	case "StartQuery":
		frame, err = ds.handleStartQuery(ctx, logsClient, logsQuery, query.TimeRange, query.RefID)
	case "StopQuery":
		frame, err = ds.handleStopQuery(ctx, logsClient, logsQuery)
	case "GetQueryResults":
		frame, err = ds.handleGetQueryResults(ctx, logsClient, logsQuery, query.RefID)
	case "GetLogEvents":
		frame, err = ds.handleGetLogEvents(ctx, logsClient, logsQuery)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to execute log action with subtype: %s: %w", logsQuery.Subtype, err)
	}

	return frame, nil
}

func (ds *DataSource) handleGetLogEvents(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery) (*data.Frame, error) {
	limit := defaultEventLimit
	if logsQuery.Limit != nil && *logsQuery.Limit > 0 {
		limit = *logsQuery.Limit
	}
	if logsQuery.LogGroupName == "" {
		return nil, backend.DownstreamError(fmt.Errorf("parameter 'logGroupName' is required"))
	}
	if logsQuery.LogStreamName == "" {
		return nil, backend.DownstreamError(fmt.Errorf("parameter 'logStreamName' is required"))
	}

	queryRequest := &cloudwatchlogs.GetLogEventsInput{
		Limit:         aws.Int32(limit),
		StartFromHead: aws.Bool(logsQuery.StartFromHead),
		LogGroupName:  &logsQuery.LogGroupName,
		LogStreamName: &logsQuery.LogStreamName,
	}

	if logsQuery.StartTime != nil && *logsQuery.StartTime != 0 {
		queryRequest.StartTime = logsQuery.StartTime
	}

	if logsQuery.EndTime != nil && *logsQuery.EndTime != 0 {
		queryRequest.EndTime = logsQuery.EndTime
	}

	logEvents, err := logsClient.GetLogEvents(ctx, queryRequest)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}

	messages := make([]*string, 0)
	timestamps := make([]time.Time, 0)

	sort.Slice(logEvents.Events, func(i, j int) bool {
		return *(logEvents.Events[i].Timestamp) > *(logEvents.Events[j].Timestamp)
	})

	for _, event := range logEvents.Events {
		messages = append(messages, event.Message)
		timestamps = append(timestamps, time.UnixMilli(*event.Timestamp).UTC())
	}

	timestampField := data.NewField("ts", nil, timestamps)
	timestampField.SetConfig(&data.FieldConfig{DisplayName: "Time"})

	messageField := data.NewField("line", nil, messages)

	return data.NewFrame("logEvents", timestampField, messageField), nil
}

func (ds *DataSource) executeStartQuery(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery, timeRange backend.TimeRange) (*cloudwatchlogs.StartQueryOutput, error) {
	startTime := timeRange.From
	endTime := timeRange.To

	if !startTime.Before(endTime) {
		return nil, backend.DownstreamError(fmt.Errorf("invalid time range: start time must be before end time"))
	}
	if logsQuery.QueryLanguage == nil {
		cwli := dataquery.LogsQueryLanguageCWLI
		logsQuery.QueryLanguage = &cwli
	}

	region := logsQuery.Region
	if region == "" || region == defaultRegion {
		region = ds.Settings.Region
	}

	isMonitoringAccount := false
	if features.IsEnabled(ctx, features.FlagCloudWatchCrossAccountQuerying) && region != "" {
		monitoringAccountStatus, err := ds.isMonitoringAccount(ctx, region)
		if err != nil {
			ds.logger.FromContext(ctx).Debug("failed to determine monitoring account status", "err", err)
		} else {
			isMonitoringAccount = monitoringAccountStatus
		}
	}

	logGroupIdentifiers := buildLogGroupIdentifiers(logsQuery.LogGroups, isMonitoringAccount)
	dataSourceIdentifiers, err := buildDataSourceIdentifiers(logsQuery.LogDataSources)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	if len(dataSourceIdentifiers) > maxDataSourceSelections {
		return nil, backend.DownstreamError(fmt.Errorf("maximum of %d data sources allowed, got %d", maxDataSourceSelections, len(dataSourceIdentifiers)))
	}

	queryPlan, err := buildStartQueryPlan(logsQuery, isMonitoringAccount, logGroupIdentifiers, dataSourceIdentifiers)
	if err != nil {
		return nil, err
	}

	startQueryInput := &cloudwatchlogs.StartQueryInput{
		StartTime: aws.Int64(startTime.Unix()),
		// Usually grafana time range allows only second precision, but you can create ranges with milliseconds
		// for example when going from trace to logs for that trace and trace length is sub second. In that case
		// StartTime is effectively floored while here EndTime is ceiled and so we should get the logs user wants
		// and also a little bit more but as CW logs accept only seconds as integers there is not much to do about
		// that.
		EndTime:     aws.Int64(int64(math.Ceil(float64(endTime.UnixNano()) / 1e9))),
		QueryString: aws.String(queryPlan.queryString),
	}

	if queryPlan.useStartQueryInputLogGroups {
		applyStartQueryLogGroupSelection(startQueryInput, logsQuery, logGroupIdentifiers, isMonitoringAccount)
	}

	if logsQuery.Limit != nil {
		startQueryInput.Limit = aws.Int32(*logsQuery.Limit)
	}
	if logsQuery.QueryLanguage != nil {
		startQueryInput.QueryLanguage = cloudwatchlogstypes.QueryLanguage(*logsQuery.QueryLanguage)
	}

	ds.logger.FromContext(ctx).Debug("Calling startquery with context with input", "input", startQueryInput)
	resp, err := logsClient.StartQuery(ctx, startQueryInput)
	if err != nil {
		if errors.Is(err, &cloudwatchlogstypes.LimitExceededException{}) {
			ds.logger.FromContext(ctx).Debug("ExecuteStartQuery limit exceeded", "err", err)
		} else if errors.Is(err, &cloudwatchlogstypes.ThrottlingException{}) {
			ds.logger.FromContext(ctx).Debug("ExecuteStartQuery rate exceeded", "err", err)
		}
		err = backend.DownstreamError(err)
	}
	return resp, err
}

func buildLogGroupIdentifiers(logGroups []dataquery.LogGroup, isMonitoringAccount bool) []string {
	if len(logGroups) == 0 {
		return nil
	}

	var logGroupIdentifiers []string
	// Log queries should use ARNs when querying a monitoring account because log group names are not unique across accounts.
	if isMonitoringAccount {
		for _, lg := range logGroups {
			if lg.Arn == "" {
				continue
			}
			// The startQuery API does not support ARNs with a trailing * so we need to remove it.
			trimmedArn := strings.TrimSuffix(lg.Arn, "*")
			if trimmedArn == "" {
				continue
			}
			logGroupIdentifiers = append(logGroupIdentifiers, trimmedArn)
		}
		return logGroupIdentifiers
	}

	// Deduplicate log group names because we only deduplicate log groups by their ARNs instead of their names when the query is created.
	seen := make(map[string]struct{}, len(logGroups))
	for _, lg := range logGroups {
		if lg.Name == "" {
			continue
		}
		if _, exists := seen[lg.Name]; !exists {
			seen[lg.Name] = struct{}{}
			logGroupIdentifiers = append(logGroupIdentifiers, lg.Name)
		}
	}
	return logGroupIdentifiers
}

func buildDataSourceIdentifiers(dataSources []dataquery.LogDataSource) ([]string, error) {
	if len(dataSources) == 0 {
		return nil, nil
	}

	seen := make(map[string]struct{}, len(dataSources))
	identifiers := make([]string, 0, len(dataSources))

	for _, ds := range dataSources {
		if ds.Name == "" || ds.Type == "" {
			return nil, fmt.Errorf("data source selection must include both name and type")
		}
		if err := validateDataSourceIdentifierPart("name", ds.Name); err != nil {
			return nil, err
		}
		if err := validateDataSourceIdentifierPart("type", ds.Type); err != nil {
			return nil, err
		}
		identifier := fmt.Sprintf("%s.%s", ds.Name, ds.Type)
		if _, exists := seen[identifier]; exists {
			continue
		}
		seen[identifier] = struct{}{}
		identifiers = append(identifiers, identifier)
	}

	return identifiers, nil
}

func buildStartQueryPlan(
	logsQuery models.LogsQuery,
	isMonitoringAccount bool,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) (startQueryPlan, error) {
	switch *logsQuery.QueryLanguage {
	case dataquery.LogsQueryLanguageCWLI:
		return buildCWLIStartQuery(logsQuery, isMonitoringAccount, logGroupIdentifiers, dataSourceIdentifiers)
	case dataquery.LogsQueryLanguagePPL:
		return buildPPLStartQuery(logsQuery, logGroupIdentifiers, dataSourceIdentifiers)
	case dataquery.LogsQueryLanguageSQL:
		return buildSQLStartQuery(logsQuery, logGroupIdentifiers, dataSourceIdentifiers)
	default:
		return startQueryPlan{
			queryString:                 logsQuery.QueryString,
			useStartQueryInputLogGroups: true,
		}, nil
	}
}

func buildCWLIStartQuery(
	logsQuery models.LogsQuery,
	isMonitoringAccount bool,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) (startQueryPlan, error) {
	usesNamePrefixScope := logsQuery.LogsQueryScope != nil && *logsQuery.LogsQueryScope == dataquery.LogsQueryScopeNamePrefix
	usesAllLogGroupsScope := logsQuery.LogsQueryScope != nil && *logsQuery.LogsQueryScope == dataquery.LogsQueryScopeAllLogGroups
	usesDirectLogGroupScope := !usesNamePrefixScope && !usesAllLogGroupsScope
	usesExactLogGroupSelection := usesDirectLogGroupScope && len(logGroupIdentifiers) > 0
	useStartQueryInputLogGroups := usesDirectLogGroupScope && (len(dataSourceIdentifiers) == 0 || usesExactLogGroupSelection)

	if usesDirectLogGroupScope && len(dataSourceIdentifiers) == 0 {
		return startQueryPlan{
			queryString:                 logContextFieldsClause + "|" + logsQuery.QueryString,
			useStartQueryInputLogGroups: useStartQueryInputLogGroups,
		}, nil
	}

	if containsSourceCommand(logsQuery.QueryString) {
		return startQueryPlan{}, backend.DownstreamError(fmt.Errorf("query cannot contain SOURCE command when SOURCE is injected automatically"))
	}

	if usesNamePrefixScope {
		if err := validateLogGroupPrefixes(logsQuery.LogGroupPrefixes); err != nil {
			return startQueryPlan{}, backend.DownstreamError(err)
		}
	}

	if usesNamePrefixScope || usesAllLogGroupsScope {
		if err := validateAccountIdentifiers(logsQuery.SelectedAccountIds); err != nil {
			return startQueryPlan{}, backend.DownstreamError(err)
		}
	}

	includeAccounts := isMonitoringAccount && (usesNamePrefixScope || usesAllLogGroupsScope) && len(logsQuery.SelectedAccountIds) > 0

	sourceLogGroupIdentifiers := logGroupIdentifiers
	if usesExactLogGroupSelection && len(dataSourceIdentifiers) > 0 {
		sourceLogGroupIdentifiers = nil
	}

	sourceClause := buildSourceClause(logsQuery, includeAccounts, sourceLogGroupIdentifiers, dataSourceIdentifiers)
	return startQueryPlan{
		queryString:                 sourceClause + " | " + logContextFieldsClause + "|" + logsQuery.QueryString,
		useStartQueryInputLogGroups: useStartQueryInputLogGroups,
	}, nil
}

func buildPPLStartQuery(
	logsQuery models.LogsQuery,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) (startQueryPlan, error) {
	if len(dataSourceIdentifiers) == 0 {
		return startQueryPlan{
			queryString:                 logsQuery.QueryString,
			useStartQueryInputLogGroups: true,
		}, nil
	}

	if containsPPLSourceCommand(logsQuery.QueryString) {
		return startQueryPlan{}, backend.DownstreamError(fmt.Errorf("query cannot contain source= when source is injected automatically"))
	}

	sourceClause := buildPPLSourceClause(logGroupIdentifiers, dataSourceIdentifiers)
	return startQueryPlan{
		queryString:                 sourceClause + " | " + logsQuery.QueryString,
		useStartQueryInputLogGroups: false,
	}, nil
}

func buildSQLStartQuery(
	logsQuery models.LogsQuery,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) (startQueryPlan, error) {
	queryString := logsQuery.QueryString

	if err := validateSQLMacroSelections(queryString, logGroupIdentifiers, dataSourceIdentifiers); err != nil {
		return startQueryPlan{}, err
	}

	var err error
	queryString, err = expandSQLLogGroupsMacro(queryString, logGroupIdentifiers)
	if err != nil {
		return startQueryPlan{}, err
	}

	queryString, err = expandSQLSourceMacro(queryString, logGroupIdentifiers, dataSourceIdentifiers)
	if err != nil {
		return startQueryPlan{}, err
	}

	return startQueryPlan{
		queryString:                 queryString,
		useStartQueryInputLogGroups: false,
	}, nil
}

func applyStartQueryLogGroupSelection(
	startQueryInput *cloudwatchlogs.StartQueryInput,
	logsQuery models.LogsQuery,
	logGroupIdentifiers []string,
	isMonitoringAccount bool,
) {
	useLogGroupIdentifiers := len(logsQuery.LogGroups) > 0 && isMonitoringAccount
	if useLogGroupIdentifiers {
		startQueryInput.LogGroupIdentifiers = logGroupIdentifiers
		return
	}

	// even though logsQuery.LogGroupNames is deprecated, we still need to support it for backwards compatibility and alert queries
	startQueryInput.LogGroupNames = append([]string(nil), logsQuery.LogGroupNames...)
	if len(startQueryInput.LogGroupNames) == 0 && len(logGroupIdentifiers) > 0 {
		startQueryInput.LogGroupNames = logGroupIdentifiers
	}
}

// containsSourceCommand checks if the query string contains a SOURCE command
func containsSourceCommand(queryString string) bool {
	return sourceCommandRegex.MatchString(queryString)
}

// containsPPLSourceCommand checks if the query string contains a PPL source= clause
func containsPPLSourceCommand(queryString string) bool {
	return pplSourceCommandRegex.MatchString(queryString)
}

// buildSourceClause constructs the SOURCE clause for CWLI queries
// includeAccounts controls whether account identifiers should be included (only valid for monitoring accounts)
func buildSourceClause(
	logsQuery models.LogsQuery,
	includeAccounts bool,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) string {
	var parts []string

	dataSourceClause := buildDataSourceClause(dataSourceIdentifiers)
	if dataSourceClause != "" {
		parts = append(parts, dataSourceClause)
	}

	logGroupsClause := buildLogGroupsSourceClause(logsQuery, includeAccounts, logGroupIdentifiers)
	if logGroupsClause != "" {
		parts = append(parts, logGroupsClause)
	}

	if len(parts) == 0 {
		return "SOURCE logGroups()"
	}

	return "SOURCE " + strings.Join(parts, " ")
}

func buildLogGroupsSourceClause(
	logsQuery models.LogsQuery,
	includeAccounts bool,
	logGroupIdentifiers []string,
) string {
	var parts []string

	usesNamePrefixScope := logsQuery.LogsQueryScope != nil && *logsQuery.LogsQueryScope == dataquery.LogsQueryScopeNamePrefix
	usesAllLogGroupsScope := logsQuery.LogsQueryScope != nil && *logsQuery.LogsQueryScope == dataquery.LogsQueryScopeAllLogGroups

	if usesNamePrefixScope || usesAllLogGroupsScope {
		if usesNamePrefixScope && len(logsQuery.LogGroupPrefixes) > 0 {
			prefixes := formatStringArrayForSource(logsQuery.LogGroupPrefixes)
			parts = append(parts, fmt.Sprintf("namePrefix: %s", prefixes))
		}

		// Add class only if not STANDARD which is the default behaviour if not specified
		if logsQuery.LogGroupClass != nil && *logsQuery.LogGroupClass != dataquery.LogGroupClassSTANDARD {
			parts = append(parts, fmt.Sprintf("class: ['%s']", *logsQuery.LogGroupClass))
		}

		if includeAccounts && len(logsQuery.SelectedAccountIds) > 0 {
			accounts := formatStringArrayForSource(logsQuery.SelectedAccountIds)
			parts = append(parts, fmt.Sprintf("accountIdentifier: %s", accounts))
		}

		if len(parts) == 0 {
			return "logGroups()"
		}

		return fmt.Sprintf("logGroups(%s)", strings.Join(parts, ", "))
	}

	if len(logGroupIdentifiers) == 0 {
		return ""
	}

	return fmt.Sprintf("logGroups(logGroupIdentifier: %s)", formatStringArrayForSource(logGroupIdentifiers))
}

func buildDataSourceClause(dataSourceIdentifiers []string) string {
	if len(dataSourceIdentifiers) == 0 {
		return ""
	}
	return fmt.Sprintf("dataSource(%s)", formatStringArrayForSource(dataSourceIdentifiers))
}

func buildPPLSourceClause(logGroupIdentifiers []string, dataSourceIdentifiers []string) string {
	if len(logGroupIdentifiers) == 0 && len(dataSourceIdentifiers) == 0 {
		return ""
	}

	parts := make([]string, 0, len(logGroupIdentifiers)+len(dataSourceIdentifiers))
	for _, ds := range dataSourceIdentifiers {
		parts = append(parts, fmt.Sprintf("ds:`%s`", ds))
	}
	for _, lg := range logGroupIdentifiers {
		parts = append(parts, fmt.Sprintf("lg:`%s`", lg))
	}

	return fmt.Sprintf("source=[%s]", strings.Join(parts, ", "))
}

func expandSQLLogGroupsMacro(queryString string, logGroupIdentifiers []string) (string, error) {
	if !strings.Contains(queryString, logGroupsMacro) {
		return queryString, nil
	}

	quoted := make([]string, len(logGroupIdentifiers))
	for i, id := range logGroupIdentifiers {
		quoted[i] = fmt.Sprintf("'%s'", id)
	}
	replacement := fmt.Sprintf("logGroups(logGroupIdentifier: [%s])", strings.Join(quoted, ", "))
	return strings.Replace(queryString, logGroupsMacro, replacement, 1), nil
}

func expandSQLSourceMacro(
	queryString string,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) (string, error) {
	if !strings.Contains(queryString, sourceMacro) {
		return queryString, nil
	}

	parts := make([]string, 0, 2)
	if len(dataSourceIdentifiers) > 0 {
		parts = append(parts, buildDataSourceClause(dataSourceIdentifiers))
	}
	if len(logGroupIdentifiers) > 0 {
		parts = append(parts, fmt.Sprintf("logGroups(logGroupIdentifier: %s)", formatStringArrayForSource(logGroupIdentifiers)))
	}

	return strings.Replace(queryString, sourceMacro, strings.Join(parts, " "), 1), nil
}

func validateSQLMacroSelections(
	queryString string,
	logGroupIdentifiers []string,
	dataSourceIdentifiers []string,
) error {
	hasLogGroupsMacro := strings.Contains(queryString, logGroupsMacro)
	hasSourceMacro := strings.Contains(queryString, sourceMacro)
	if !hasLogGroupsMacro && !hasSourceMacro {
		return nil
	}
	if strings.Count(queryString, sourceMacro) > 1 {
		return backend.DownstreamError(fmt.Errorf("query contains multiple %s macros; only one is supported", sourceMacro))
	}

	hasLogGroupSelection := len(logGroupIdentifiers) > 0
	hasDataSourceSelection := len(dataSourceIdentifiers) > 0

	switch {
	case hasLogGroupsMacro && !hasLogGroupSelection:
		return backend.DownstreamError(fmt.Errorf("query contains %s but no log groups are selected", logGroupsMacro))
	case hasSourceMacro && !hasLogGroupSelection && !hasDataSourceSelection:
		return backend.DownstreamError(fmt.Errorf("query contains %s but no log groups or data sources are selected", sourceMacro))
	default:
		return nil
	}
}

func formatStringArrayForSource(arr []string) string {
	quoted := make([]string, len(arr))
	for i, s := range arr {
		quoted[i] = fmt.Sprintf("'%s'", s)
	}
	return fmt.Sprintf("[%s]", strings.Join(quoted, ", "))
}

func validateLogGroupPrefixes(prefixes []string) error {
	if len(prefixes) == 0 {
		return fmt.Errorf("at least one log group prefix is required for Name prefix mode")
	}
	if len(prefixes) > maxSourceLogGroupPrefixes {
		return fmt.Errorf("maximum of %d log group prefixes allowed, got %d", maxSourceLogGroupPrefixes, len(prefixes))
	}
	for _, prefix := range prefixes {
		if len(prefix) < minSourceLogGroupPrefixLen {
			return fmt.Errorf("log group prefix %q must be at least %d characters", prefix, minSourceLogGroupPrefixLen)
		}
		if strings.Contains(prefix, "*") {
			return fmt.Errorf("log group prefix %q cannot contain wildcard character '*'", prefix)
		}
	}
	return nil
}

func validateAccountIdentifiers(accounts []string) error {
	if len(accounts) > maxSourceAccountIdentifiers {
		return fmt.Errorf("maximum of %d account identifiers allowed, got %d", maxSourceAccountIdentifiers, len(accounts))
	}
	return nil
}

func validateDataSourceIdentifierPart(kind string, value string) error {
	if !dataSourceIdentifierPartRegex.MatchString(value) {
		return fmt.Errorf("data source %s %q must contain only letters, numbers, hyphens, or underscores", kind, value)
	}
	return nil
}

func (ds *DataSource) handleStartQuery(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery, timeRange backend.TimeRange, refID string) (*data.Frame, error) {
	startQueryResponse, err := ds.executeStartQuery(ctx, logsClient, logsQuery, timeRange)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame(refID, data.NewField("queryId", nil, []string{*startQueryResponse.QueryId}))
	dataFrame.RefID = refID

	region := "default"
	if logsQuery.Region != "" {
		region = logsQuery.Region
	}

	dataFrame.Meta = &data.FrameMeta{
		Custom: map[string]any{
			"Region": region,
		},
	}

	return dataFrame, nil
}

func (ds *DataSource) executeStopQuery(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery) (*cloudwatchlogs.StopQueryOutput, error) {
	queryInput := &cloudwatchlogs.StopQueryInput{
		QueryId: aws.String(logsQuery.QueryId),
	}

	response, err := logsClient.StopQuery(ctx, queryInput)
	if err != nil {
		// If the query has already stopped by the time CloudWatch receives the stop query request,
		// an "InvalidParameterException" error is returned. For our purposes though the query has been
		// stopped, so we ignore the error.
		if errors.Is(err, &cloudwatchlogstypes.InvalidParameterException{}) {
			response = &cloudwatchlogs.StopQueryOutput{Success: false}
			err = nil
		} else {
			err = backend.DownstreamError(err)
		}
	}

	return response, err
}

func (ds *DataSource) handleStopQuery(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery) (*data.Frame, error) {
	response, err := ds.executeStopQuery(ctx, logsClient, logsQuery)
	if err != nil {
		return nil, err
	}

	dataFrame := data.NewFrame("StopQueryResponse", data.NewField("success", nil, []bool{response.Success}))
	return dataFrame, nil
}

func (ds *DataSource) executeGetQueryResults(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	queryInput := &cloudwatchlogs.GetQueryResultsInput{
		QueryId: aws.String(logsQuery.QueryId),
	}

	getQueryResultsResponse, err := logsClient.GetQueryResults(ctx, queryInput)
	if err != nil {
		var awsErr smithy.APIError
		if errors.As(err, &awsErr) {
			err = &AWSError{Code: awsErr.ErrorCode(), Message: awsErr.ErrorMessage()}
		}
		err = backend.DownstreamError(err)
	}
	return getQueryResultsResponse, err
}

func (ds *DataSource) handleGetQueryResults(ctx context.Context, logsClient models.CWLogsClient,
	logsQuery models.LogsQuery, refID string) (*data.Frame, error) {
	getQueryResultsOutput, err := ds.executeGetQueryResults(ctx, logsClient, logsQuery)
	if err != nil {
		return nil, err
	}

	dataFrame, err := logsResultsToDataframes(getQueryResultsOutput, logsQuery.StatsGroups)
	if err != nil {
		return nil, err
	}

	dataFrame.Name = refID
	dataFrame.RefID = refID

	return dataFrame, nil
}

func groupResponseFrame(frame *data.Frame, statsGroups []string) (data.Frames, error) {
	var dataFrames data.Frames

	// When a query of the form "stats ... by ..." is made, we want to return
	// one series per group defined in the query, but due to the format
	// the query response is in, there does not seem to be a way to tell
	// by the response alone if/how the results should be grouped.
	// Because of this, if the frontend sees that a "stats ... by ..." query is being made
	// the "statsGroups" parameter is sent along with the query to the backend so that we
	// can correctly group the CloudWatch logs response.
	// Check if we have time field though as it makes sense to split only for time series.
	if hasTimeField(frame) {
		if len(statsGroups) > 0 && len(frame.Fields) > 0 {
			groupedFrames, err := groupResults(frame, statsGroups, false)
			if err != nil {
				return nil, err
			}

			dataFrames = groupedFrames
		} else {
			setPreferredVisType(frame, "logs")
			dataFrames = data.Frames{frame}
		}
	} else {
		dataFrames = data.Frames{frame}
	}
	return dataFrames, nil
}

func setPreferredVisType(frame *data.Frame, visType data.VisType) {
	if frame.Meta != nil {
		frame.Meta.PreferredVisualization = visType
	} else {
		frame.Meta = &data.FrameMeta{
			PreferredVisualization: visType,
		}
	}
}

func hasTimeField(frame *data.Frame) bool {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeNullableTime {
			return true
		}
	}
	return false
}
