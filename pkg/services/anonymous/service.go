package anonymous

import (
	"context"
	"net/http"
)

type Service interface {
	TagSession(context.Context, *http.Request) error
}
