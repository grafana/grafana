package auditimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/audit"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(
	db db.DB,
	orgService org.Service,
	cfg *setting.Cfg,
	teamService team.Service,
	cacheService *localcache.CacheService,
	quotaService quota.Service,
	bundleRegistry supportbundles.Service,
) (audit.Service, error) {
	store := ProvideStore(db, cfg)
	s := &Service{
		store: &store,
	}

	return s, nil
}

func (s *Service) CreateAuditRecord(ctx context.Context, cmd *audit.CreateAuditRecordCommand) error {
	// create record
	record := &audit.AuditRecord{
		Username:  cmd.Username,
		Action:    cmd.Action,
		IpAddress: cmd.IpAddress,
		CreatedAt: time.Now(),
	}

	_, err := s.store.Insert(ctx, record)
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) Search(ctx context.Context, query *audit.SearchAuditRecordsQuery) (*audit.SearchAuditRecordsQueryResult, error) {
	return s.store.Search(ctx, query)
}
