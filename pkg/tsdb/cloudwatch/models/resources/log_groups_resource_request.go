package resources

import (
	"fmt"
	"net/url"
	"strconv"
)

const (
	defaultLogGroupLimit = int32(50)
	// defaultMaxLogGroupsResults caps total results when ListAllLogGroups is true to avoid timeouts (0 = no cap)
	defaultMaxLogGroupsResults = int32(1000)
)

// LogGroupOrderBy defines sort order for log groups (empty = no sorting, return order from API).
const (
	OrderByNameAsc      = "nameAsc"
	OrderByNameDesc     = "nameDesc"
	OrderByAccountIDAsc = "accountIdAsc"
	OrderByAccountIDDesc = "accountIdDesc"
)

type LogGroupsRequest struct {
	ResourceRequest
	Limit                                   int32
	LogGroupNamePrefix, LogGroupNamePattern *string
	ListAllLogGroups                        bool
	OrderBy                                 string
	MaxResults                              int32
}

func (r LogGroupsRequest) IsTargetingAllAccounts() bool {
	return *r.AccountId == "all"
}

func ParseLogGroupsRequest(parameters url.Values) (LogGroupsRequest, error) {
	logGroupNamePrefix := setIfNotEmptyString(parameters.Get("logGroupNamePrefix"))
	logGroupPattern := setIfNotEmptyString(parameters.Get("logGroupPattern"))
	if logGroupNamePrefix != nil && logGroupPattern != nil {
		return LogGroupsRequest{}, fmt.Errorf("cannot set both log group name prefix and pattern")
	}

	return LogGroupsRequest{
		Limit: getLimit(parameters.Get("limit")),
		ResourceRequest: ResourceRequest{
			Region:    parameters.Get("region"),
			AccountId: setIfNotEmptyString(parameters.Get("accountId")),
		},
		LogGroupNamePrefix:  logGroupNamePrefix,
		LogGroupNamePattern: logGroupPattern,
		ListAllLogGroups:    parameters.Get("listAllLogGroups") == "true",
		OrderBy:             parameters.Get("orderBy"),
		MaxResults:          getMaxResults(parameters.Get("maxResults")),
	}, nil
}

func setIfNotEmptyString(paramValue string) *string {
	if paramValue == "" {
		return nil
	}
	return &paramValue
}

func getLimit(limit string) int32 {
	logGroupLimit := defaultLogGroupLimit
	intLimit, err := strconv.ParseInt(limit, 10, 32)
	if err == nil && intLimit > 0 {
		logGroupLimit = int32(intLimit)
	}
	return logGroupLimit
}

func getMaxResults(maxResults string) int32 {
	if maxResults == "" {
		return defaultMaxLogGroupsResults
	}
	n, err := strconv.ParseInt(maxResults, 10, 32)
	if err != nil || n <= 0 {
		return defaultMaxLogGroupsResults
	}
	return int32(n)
}
