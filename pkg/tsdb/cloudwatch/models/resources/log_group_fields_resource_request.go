package resources

import (
	"fmt"
	"net/url"
)

type LogGroupFieldsRequest struct {
	ResourceRequest
	LogGroupName string
	LogGroupARN  string
}

func ParseLogGroupFieldsRequest(parameters url.Values) (LogGroupFieldsRequest, error) {
	resourceRequest, err := getResourceRequest(parameters)
	if err != nil {
		return LogGroupFieldsRequest{}, err
	}

	request := LogGroupFieldsRequest{
		ResourceRequest: *resourceRequest,
		LogGroupName:    parameters.Get("logGroupName"),
		LogGroupARN:     parameters.Get("logGroupArn"),
	}

	if request.LogGroupName == "" && request.LogGroupARN == "" {
		return LogGroupFieldsRequest{}, fmt.Errorf("you need to specify either logGroupName or logGroupArn")
	}

	return request, nil
}
