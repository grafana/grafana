// Package patpolicy resolves whether personal access tokens are enabled for the
// instance and for each organization, and lets admins change that at runtime.
// The database is authoritative so every HA replica converges within cacheTTL.
package patpolicy

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	namespace = "personalaccesstokens.policy"
	key       = "enabled"
	cacheTTL  = 30 * time.Second
)

var ErrManagedByConfig = errors.New("personal access tokens are managed by configuration")

// Policy answers the questions the authn client and token service need at request time.
type Policy interface {
	// InstanceEnabled is the instance-wide switch.
	InstanceEnabled(ctx context.Context) bool
	// OrgEnabled is true only when the instance and the org both allow tokens.
	OrgEnabled(ctx context.Context, orgID int64) bool
}

// Actor identifies who changed the policy, for auditing.
type Actor struct {
	UserID int64
	OrgID  int64
	IP     string
}

// State is returned to admins.
type State struct {
	Enabled         bool `json:"enabled"`
	ManagedByConfig bool `json:"managedByConfig"`
}

type Service struct {
	kv    kvstore.KVStore
	store patstore.Store
	cfg   *setting.Cfg
	log   log.Logger
	now   func() time.Time

	mu    sync.Mutex
	cache map[int64]cacheEntry
}

type cacheEntry struct {
	value   *bool
	fetched time.Time
}

func ProvideService(kv kvstore.KVStore, store patstore.Store, cfg *setting.Cfg) *Service {
	return &Service{kv: kv, store: store, cfg: cfg, log: log.New("personalaccesstokens.policy"), now: time.Now, cache: map[int64]cacheEntry{}}
}

// override returns the stored switch for the org (0 = instance), or nil when unset.
// Read errors fail closed to "disabled" for the caller via the returned error.
func (s *Service) override(ctx context.Context, orgID int64) (*bool, error) {
	s.mu.Lock()
	if e, ok := s.cache[orgID]; ok && s.now().Sub(e.fetched) < cacheTTL {
		s.mu.Unlock()
		return e.value, nil
	}
	s.mu.Unlock()

	raw, found, err := s.kv.Get(ctx, orgID, namespace, key)
	if err != nil {
		return nil, err
	}
	var v *bool
	if found {
		b, perr := strconv.ParseBool(raw)
		if perr == nil {
			v = &b
		}
	}
	s.mu.Lock()
	s.cache[orgID] = cacheEntry{value: v, fetched: s.now()}
	s.mu.Unlock()
	return v, nil
}

func (s *Service) instance(ctx context.Context) (bool, error) {
	if !s.cfg.PersonalAccessTokens.AllowRuntimeOverride {
		return s.cfg.PersonalAccessTokens.Enabled, nil
	}
	v, err := s.override(ctx, 0)
	if err != nil {
		return false, err
	}
	if v != nil {
		return *v, nil
	}
	return s.cfg.PersonalAccessTokens.Enabled, nil
}

func (s *Service) InstanceEnabled(ctx context.Context) bool {
	on, err := s.instance(ctx)
	if err != nil {
		s.log.Warn("Failed to read personal access token policy; failing closed", "error", err)
		return false
	}
	return on
}

func (s *Service) OrgEnabled(ctx context.Context, orgID int64) bool {
	if !s.InstanceEnabled(ctx) {
		return false
	}
	v, err := s.override(ctx, orgID)
	if err != nil {
		s.log.Warn("Failed to read org personal access token policy; failing closed", "error", err, "org_id", orgID)
		return false
	}
	return v == nil || *v
}

func (s *Service) GetInstance(ctx context.Context) (State, error) {
	on, err := s.instance(ctx)
	return State{Enabled: on, ManagedByConfig: !s.cfg.PersonalAccessTokens.AllowRuntimeOverride}, err
}

func (s *Service) GetOrg(ctx context.Context, orgID int64) (State, error) {
	v, err := s.override(ctx, orgID)
	if err != nil {
		return State{}, err
	}
	return State{Enabled: v == nil || *v}, nil
}

// SetInstance changes the instance switch. With revokeExisting, disabling also permanently revokes all tokens.
func (s *Service) SetInstance(ctx context.Context, actor Actor, enabled, revokeExisting bool) (int64, error) {
	if !s.cfg.PersonalAccessTokens.AllowRuntimeOverride {
		return 0, ErrManagedByConfig
	}
	old, _ := s.instance(ctx)
	if err := s.set(ctx, 0, enabled); err != nil {
		return 0, err
	}
	var n int64
	if !enabled && revokeExisting {
		var err error
		if n, err = s.store.RevokeAll(ctx, patstore.ReasonAdminPolicy); err != nil {
			return 0, err
		}
	}
	s.audit("instance_policy_change", actor, 0, old, enabled, revokeExisting, n)
	return n, nil
}

// SetOrg changes the org switch; it can only narrow what the instance allows.
func (s *Service) SetOrg(ctx context.Context, actor Actor, orgID int64, enabled, revokeExisting bool) (int64, error) {
	old := true
	if v, err := s.override(ctx, orgID); err == nil && v != nil {
		old = *v
	}
	if err := s.set(ctx, orgID, enabled); err != nil {
		return 0, err
	}
	var n int64
	if !enabled && revokeExisting {
		var err error
		if n, err = s.store.RevokeAllInOrg(ctx, orgID, patstore.ReasonAdminPolicy); err != nil {
			return 0, err
		}
	}
	s.audit("org_policy_change", actor, orgID, old, enabled, revokeExisting, n)
	return n, nil
}

func (s *Service) set(ctx context.Context, orgID int64, enabled bool) error {
	if err := s.kv.Set(ctx, orgID, namespace, key, strconv.FormatBool(enabled)); err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.cache, orgID)
	s.mu.Unlock()
	return nil
}

func (s *Service) audit(action string, a Actor, orgID int64, oldVal, newVal, revoke bool, revoked int64) {
	s.log.Info("Personal access token policy changed", "audit", true, "action", action, "actor_user_id", a.UserID,
		"actor_org_id", a.OrgID, "ip", a.IP, "target_org_id", orgID, "old", oldVal, "new", newVal,
		"revoke_existing", revoke, "revoked", revoked)
}
