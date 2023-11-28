package hooks

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type IndexDataHook func(indexData *dtos.IndexViewData, req *contextmodel.ReqContext)

type HooksService struct {
	indexDataHooks []IndexDataHook
}

func ProvideService() *HooksService {
	return &HooksService{}
}

func (srv *HooksService) AddIndexDataHook(hook IndexDataHook) {
	srv.indexDataHooks = append(srv.indexDataHooks, hook)
}

func (srv *HooksService) RunIndexDataHooks(indexData *dtos.IndexViewData, req *contextmodel.ReqContext) {
	for _, hook := range srv.indexDataHooks {
		hook(indexData, req)
	}
}
