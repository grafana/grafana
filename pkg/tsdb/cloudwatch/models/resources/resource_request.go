package resources

import (
	"fmt"
	"net/url"
)

const useLinkedAccountsId = "all"

type ResourceRequest struct {
	Region    string
	AccountId *string
}

func (r *ResourceRequest) ShouldTargetAllAccounts() bool {
	return r.AccountId != nil && *r.AccountId == useLinkedAccountsId
}

func getResourceRequest(parameters url.Values) (*ResourceRequest, error) {
	request := &ResourceRequest{
		Region: parameters.Get("region"),
	}

	accountId := parameters.Get("accountId")
	if accountId != "" {
		request.AccountId = &accountId
	}

	if request.Region == "" {
		return nil, fmt.Errorf("region is required")
	}

	return request, nil
}

type LogsRequest struct {
	Limit                                              int64
	AccountId, LogGroupNamePrefix, LogGroupNamePattern *string
	IsCrossAccountQueryingEnabled                      bool
}

func (r LogsRequest) IsTargetingAllAccounts() bool {
	return *r.AccountId == useLinkedAccountsId
}
