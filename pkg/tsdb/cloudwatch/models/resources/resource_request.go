package resources

import (
	"fmt"
	"net/url"
)

type ResourceRequest struct {
	Region string
}

func getResourceRequest(parameters url.Values) (*ResourceRequest, error) {
	request := &ResourceRequest{
		Region: parameters.Get("region"),
	}

	if request.Region == "" {
		return nil, fmt.Errorf("region is required")
	}

	return request, nil
}
