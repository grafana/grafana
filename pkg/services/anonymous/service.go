package anonymous

import (
	"context"
	"net/http"
)

type Service interface {
	TagDevice(context.Context, *http.Request) error
}
