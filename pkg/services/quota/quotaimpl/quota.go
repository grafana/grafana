package quotaimpl

import (
	"context"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

type serviceDisabled struct {
}

func (s *serviceDisabled) QuotaReached(c *contextmodel.ReqContext, targetSrv quota.TargetSrv) (bool, error) {
	return false, nil
}

func (s *serviceDisabled) GetQuotasByScope(ctx context.Context, scope quota.Scope, id int64) ([]quota.QuotaDTO, error) {
	return nil, quota.ErrDisabled
}

func (s *serviceDisabled) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	return quota.ErrDisabled
}

func (s *serviceDisabled) CheckQuotaReached(ctx context.Context, targetSrv quota.TargetSrv, scopeParams *quota.ScopeParameters) (bool, error) {
	return false, nil
}

func (s *serviceDisabled) DeleteQuotaForUser(ctx context.Context, userID int64) error {
	return nil
}

func (s *serviceDisabled) RegisterQuotaReporter(e *quota.NewUsageReporter) error {
	return nil
}

type service struct {
	store  store
	Cfg    *setting.Cfg
	Logger log.Logger

	mutex     sync.RWMutex
	reporters map[quota.TargetSrv]quota.UsageReporterFunc

	defaultLimits *quota.Map

	targetToSrv *quota.TargetToSrv
}

func ProvideService(db db.DB, cfg *setting.Cfg) quota.Service {
	logger := log.New("quota_service")
	s := service{
		store:         &sqlStore{db: db, logger: logger},
		Cfg:           cfg,
		Logger:        logger,
		reporters:     make(map[quota.TargetSrv]quota.UsageReporterFunc),
		defaultLimits: &quota.Map{},
		targetToSrv:   quota.NewTargetToSrv(),
	}

	if s.IsDisabled() {
		return &serviceDisabled{}
	}

	return &s
}

func (s *service) IsDisabled() bool {
	return !s.Cfg.Quota.Enabled
}

// QuotaReached checks that quota is reached for a target. Runs CheckQuotaReached and take context and scope parameters from the request context
func (s *service) QuotaReached(c *contextmodel.ReqContext, targetSrv quota.TargetSrv) (bool, error) {
	// No request context means this is a background service, like LDAP Background Sync
	if c == nil {
		return false, nil
	}

	params := &quota.ScopeParameters{}
	if c.IsSignedIn {
		params.OrgID = c.OrgID
		params.UserID = c.UserID
	}
	return s.CheckQuotaReached(c.Req.Context(), targetSrv, params)
}

func (s *service) GetQuotasByScope(ctx context.Context, scope quota.Scope, id int64) ([]quota.QuotaDTO, error) {
	if err := scope.Validate(); err != nil {
		return nil, err
	}

	q := make([]quota.QuotaDTO, 0)

	scopeParams := quota.ScopeParameters{}
	if scope == quota.OrgScope {
		scopeParams.OrgID = id
	} else if scope == quota.UserScope {
		scopeParams.UserID = id
	}

	c, err := s.getContext(ctx)
	if err != nil {
		return nil, err
	}
	customLimits, err := s.store.Get(c, &scopeParams)
	if err != nil {
		return nil, err
	}

	u, err := s.getUsage(ctx, &scopeParams)
	if err != nil {
		return nil, err
	}

	for item := range s.defaultLimits.Iter() {
		limit := item.Value

		scp, err := item.Tag.GetScope()
		if err != nil {
			return nil, err
		}

		if scp != scope {
			continue
		}

		if targetCustomLimit, ok := customLimits.Get(item.Tag); ok {
			limit = targetCustomLimit
		}

		target, err := item.Tag.GetTarget()
		if err != nil {
			return nil, err
		}

		srv, err := item.Tag.GetSrv()
		if err != nil {
			return nil, err
		}

		used, _ := u.Get(item.Tag)
		q = append(q, quota.QuotaDTO{
			Target:  string(target),
			Limit:   limit,
			OrgId:   scopeParams.OrgID,
			UserId:  scopeParams.UserID,
			Used:    used,
			Service: string(srv),
			Scope:   string(scope),
		})
	}

	return q, nil
}

func (s *service) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	targetFound := false
	knownTargets, err := s.defaultLimits.Targets()
	if err != nil {
		return err
	}

	for t := range knownTargets {
		if t == quota.Target(cmd.Target) {
			targetFound = true
		}
	}
	if !targetFound {
		return quota.ErrInvalidTarget.Errorf("unknown quota target: %s", cmd.Target)
	}

	c, err := s.getContext(ctx)
	if err != nil {
		return err
	}
	return s.store.Update(c, cmd)
}

// CheckQuotaReached check that quota is reached for a target. If ScopeParameters are not defined, only global scope is checked
func (s *service) CheckQuotaReached(ctx context.Context, targetSrv quota.TargetSrv, scopeParams *quota.ScopeParameters) (bool, error) {
	targetSrvLimits, err := s.getOverridenLimits(ctx, targetSrv, scopeParams)
	if err != nil {
		return false, err
	}

	usageReporterFunc, ok := s.getReporter(targetSrv)
	if !ok {
		return false, quota.ErrInvalidTargetSrv
	}
	targetUsage, err := usageReporterFunc(ctx, scopeParams)
	if err != nil {
		return false, err
	}

	for t, limit := range targetSrvLimits {
		switch {
		case limit < 0:
			continue
		case limit == 0:
			return true, nil
		default:
			scope, err := t.GetScope()
			if err != nil {
				return false, quota.ErrFailedToGetScope.Errorf("failed to get the scope for target: %s", t)
			}

			// do not check user quota if the user information is not available (eg no user is signed in)
			if scope == quota.UserScope && (scopeParams == nil || scopeParams.UserID == 0) {
				continue
			}

			// do not check user quota if the org information is not available (eg no user is signed in)
			if scope == quota.OrgScope && (scopeParams == nil || scopeParams.OrgID == 0) {
				continue
			}

			u, ok := targetUsage.Get(t)
			if !ok {
				return false, quota.ErrUsageFoundForTarget.Errorf("no usage for target:%s", t)
			}
			if u >= limit {
				return true, nil
			}
		}
	}
	return false, nil
}

func (s *service) DeleteQuotaForUser(ctx context.Context, userID int64) error {
	c, err := s.getContext(ctx)
	if err != nil {
		return err
	}
	return s.store.DeleteByUser(c, userID)
}

func (s *service) RegisterQuotaReporter(e *quota.NewUsageReporter) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, ok := s.reporters[e.TargetSrv]
	if ok {
		return quota.ErrTargetSrvConflict.Errorf("target service: %s already exists", e.TargetSrv)
	}

	s.reporters[e.TargetSrv] = e.Reporter

	for item := range e.DefaultLimits.Iter() {
		target, err := item.Tag.GetTarget()
		if err != nil {
			return err
		}
		srv, err := item.Tag.GetSrv()
		if err != nil {
			return err
		}
		s.targetToSrv.Set(target, srv)
		s.defaultLimits.Set(item.Tag, item.Value)
	}

	return nil
}

func (s *service) getReporter(target quota.TargetSrv) (quota.UsageReporterFunc, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	r, ok := s.reporters[target]
	return r, ok
}

type reporter struct {
	target       quota.TargetSrv
	reporterFunc quota.UsageReporterFunc
}

func (s *service) getReporters() <-chan reporter {
	ch := make(chan reporter)
	go func() {
		s.mutex.RLock()
		defer func() {
			s.mutex.RUnlock()
			close(ch)
		}()
		for t, r := range s.reporters {
			ch <- reporter{target: t, reporterFunc: r}
		}
	}()

	return ch
}

func (s *service) getOverridenLimits(ctx context.Context, targetSrv quota.TargetSrv, scopeParams *quota.ScopeParameters) (map[quota.Tag]int64, error) {
	targetSrvLimits := make(map[quota.Tag]int64)

	c, err := s.getContext(ctx)
	if err != nil {
		return nil, err
	}
	customLimits, err := s.store.Get(c, scopeParams)
	if err != nil {
		return targetSrvLimits, err
	}

	for item := range s.defaultLimits.Iter() {
		srv, err := item.Tag.GetSrv()
		if err != nil {
			return nil, err
		}

		if srv != targetSrv {
			continue
		}

		defaultLimit := item.Value

		if customLimit, ok := customLimits.Get(item.Tag); ok {
			targetSrvLimits[item.Tag] = customLimit
		} else {
			targetSrvLimits[item.Tag] = defaultLimit
		}
	}

	return targetSrvLimits, nil
}

func (s *service) getUsage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	usage := &quota.Map{}
	g, ctx := errgroup.WithContext(ctx)

	for r := range s.getReporters() {
		r := r
		g.Go(func() error {
			u, err := r.reporterFunc(ctx, scopeParams)
			if err != nil {
				return err
			}
			usage.Merge(u)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return usage, nil
}

func (s *service) getContext(ctx context.Context) (quota.Context, error) {
	return quota.FromContext(ctx, s.targetToSrv), nil
}
