package authnimpl

import "github.com/grafana/grafana/pkg/services/authn"

var _ authn.Service = new(Service)

type Service struct {
}
