package labelsuggestion

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, accessControl ac.AccessControl) *LabelSuggestionService {
	s := &LabelSuggestionService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("label-suggestion"),
		now:           time.Now,
		queryHistory:  queryhistory.ProvideService(cfg, sqlStore, routeRegister, accessControl),
	}

	s.registerAPIEndpoints()

	return s
}

type Service interface {
	GetLabelSuggestion(ctx context.Context, user *user.SignedInUser, datasourceUID string) (LabelSuggestionResult, error)
}

type LabelSuggestionService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
	queryHistory  *queryhistory.QueryHistoryService
}

func (s LabelSuggestionService) GetLabelSuggestion(ctx context.Context, user *user.SignedInUser, datasourceUID string) (LabelSuggestionResult, error) {
	if user != nil {
		return s.getUserLabelSuggestion(ctx, user)
	} else if datasourceUID != "" {
		return s.getDatasourceLabelSuggestion(ctx, datasourceUID)
	} else {
		return s.getGeneralLabelSuggestion(ctx)
	}
}
