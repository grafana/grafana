package models

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/pkg/errors"
)

func DataResponseErrorUnmarshal(err error) backend.DataResponse {
	return backend.DataResponse{
		Error: errors.Wrap(err, "failed to unmarshal JSON request into query"),
	}
}

func DataResponseErrorRequestFailed(err error) backend.DataResponse {
	return backend.DataResponse{
		Error: errors.Wrap(err, "failed to fetch query data"),
	}
}

func DataResponseErrorBadRequest(message string) backend.DataResponse {
	return backend.DataResponse{
		Error: errors.New(fmt.Sprint("bad request: ", message)),
	}
}
