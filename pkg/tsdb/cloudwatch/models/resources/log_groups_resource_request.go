package resources

import (
	"fmt"
	"net/url"
	"strconv"
)

const defaultLogGroupLimit = int64(50)

type LogGroupsRequest struct {
	ResourceRequest
	Limit                                   int64
	LogGroupNamePrefix, LogGroupNamePattern *string
	ListAllLogGroups                        bool
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
	}, nil
}

func setIfNotEmptyString(paramValue string) *string {
	if paramValue == "" {
		return nil
	}
	return &paramValue
}

func getLimit(limit string) int64 {
	logGroupLimit := defaultLogGroupLimit
	intLimit, err := strconv.ParseInt(limit, 10, 64)
	if err == nil && intLimit > 0 {
		logGroupLimit = intLimit
	}
	return logGroupLimit
}
