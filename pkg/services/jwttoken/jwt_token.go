package jwttoken

import (
	"context"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	Cfg             *setting.Cfg
	AuthInfoService login.AuthInfoService
	tracer          tracing.Tracer
}

var _ JWTTokenService = (*Service)(nil)

type JWTTokenService interface {
	GetCurrentJWTToken(context.Context, identity.Requester, *contextmodel.ReqContext) (token string, headerName string)
}

func (o *Service) GetCurrentJWTToken(ctx context.Context, usr identity.Requester, reqCtx *contextmodel.ReqContext) (string, string) {
	if usr == nil || usr.GetAuthenticatedBy() != login.JWTModule {
		return "", ""
	}

	return reqCtx.Req.Header.Get(o.Cfg.JWTAuth.HeaderName), o.Cfg.JWTAuth.HeaderName
}

func ProvideService(cfg *setting.Cfg) *Service {
	return &Service{
		Cfg: cfg,
	}
}
