package resources

import "net/url"

type DataSourcesRequest struct {
	Region  string
	Pattern *string
}

func ParseDataSourcesRequest(parameters url.Values) (DataSourcesRequest, error) {
	return DataSourcesRequest{
		Region:  parameters.Get("region"),
		Pattern: setIfNotEmptyString(parameters.Get("pattern")),
	}, nil
}
