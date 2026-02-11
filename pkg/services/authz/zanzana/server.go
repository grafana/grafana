package zanzana

import (
	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type Server interface {
	authzv1.AuthzServiceServer
	authzextv1.AuthzExtentionServiceServer
	Close()
}
