package quota

import (
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrBadRequest = errutil.NewBase(errutil.StatusBadRequest, "quota.bad-request")
var ErrInvalidTargetSrv = errutil.NewBase(errutil.StatusBadRequest, "quota.invalid-target")
var ErrInvalidScope = errutil.NewBase(errutil.StatusBadRequest, "quota.invalid-scope")
var ErrFailedToGetScope = errutil.NewBase(errutil.StatusInternal, "quota.failed-get-scope")
var ErrInvalidTarget = errutil.NewBase(errutil.StatusInternal, "quota.invalid-target-table")
var ErrUsageFoundForTarget = errutil.NewBase(errutil.StatusNotFound, "quota.missing-target-usage")
var ErrTargetSrvConflict = errutil.NewBase(errutil.StatusBadRequest, "quota.target-srv-conflict")
var ErrDisabled = errutil.NewBase(errutil.StatusForbidden, "quota.disabled", errutil.WithPublicMessage("Quotas not enabled"))
var ErrInvalidTagFormat = errutil.NewBase(errutil.StatusInternal, "quota.invalid-invalid-tag-format")

type ScopeParameters struct {
	OrgID  int64
	UserID int64
}

type Scope string

const (
	GlobalScope Scope = "global"
	OrgScope    Scope = "org"
	UserScope   Scope = "user"
)

func (s Scope) Validate() error {
	switch s {
	case GlobalScope, OrgScope, UserScope:
		return nil
	default:
		return ErrInvalidScope.Errorf("bad scope: %s", s)
	}
}

type TargetSrv string

type Target string

const delimiter = ":"

// Tag is a string with the format <srv>:<target>:<scope>
type Tag string

func NewTag(srv TargetSrv, t Target, scope Scope) (Tag, error) {
	if err := scope.Validate(); err != nil {
		return "", err
	}

	tag := Tag(strings.Join([]string{string(srv), string(t), string(scope)}, delimiter))
	return tag, nil
}

func (t Tag) split() ([]string, error) {
	parts := strings.SplitN(string(t), delimiter, -1)
	if len(parts) != 3 {
		return nil, ErrInvalidTagFormat.Errorf("tag format should be ^(?<srv>\\w):(?<target>\\w):(?<scope>\\w)$")
	}

	return parts, nil
}

func (t Tag) GetSrv() (TargetSrv, error) {
	parts, err := t.split()
	if err != nil {
		return "", err
	}
	return TargetSrv(parts[0]), nil
}

func (t Tag) GetTarget() (Target, error) {
	parts, err := t.split()
	if err != nil {
		return "", err
	}
	return Target(parts[1]), nil
}

func (t Tag) GetScope() (Scope, error) {
	parts, err := t.split()
	if err != nil {
		return "", err
	}
	return Scope(parts[2]), nil
}

type Item struct {
	Tag   Tag
	Value int64
}

type Map struct {
	mutex sync.RWMutex
	m     map[Tag]int64
}

func (m *Map) Set(tag Tag, limit int64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if len(m.m) == 0 {
		m.m = make(map[Tag]int64, 0)
	}
	m.m[tag] = limit
}

func (m *Map) Get(tag Tag) (int64, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	limit, ok := m.m[tag]
	return limit, ok
}

func (m *Map) Merge(l2 *Map) {
	l2.mutex.RLock()
	defer l2.mutex.RUnlock()

	for k, v := range l2.m {
		// TODO check for conflicts?
		m.Set(k, v)
	}
}

func (m *Map) Iter() <-chan Item {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	ch := make(chan Item)
	go func() {
		defer close(ch)
		for t, v := range m.m {
			ch <- Item{Tag: t, Value: v}
		}
	}()

	return ch
}

func (m *Map) Scopes() (map[Scope]struct{}, error) {
	res := make(map[Scope]struct{})
	for item := range m.Iter() {
		scope, err := item.Tag.GetScope()
		if err != nil {
			return nil, err
		}
		res[scope] = struct{}{}
	}
	return res, nil
}

func (m *Map) Services() (map[TargetSrv]struct{}, error) {
	res := make(map[TargetSrv]struct{})
	for item := range m.Iter() {
		srv, err := item.Tag.GetSrv()
		if err != nil {
			return nil, err
		}
		res[srv] = struct{}{}
	}
	return res, nil
}

func (m *Map) Targets() (map[Target]struct{}, error) {
	res := make(map[Target]struct{})
	for item := range m.Iter() {
		target, err := item.Tag.GetTarget()
		if err != nil {
			return nil, err
		}
		res[target] = struct{}{}
	}
	return res, nil
}

type Quota struct {
	Id      int64
	OrgId   int64
	UserId  int64
	Target  string
	Limit   int64
	Created time.Time
	Updated time.Time
}

type QuotaDTO struct {
	OrgId   int64  `json:"org_id,omitempty"`
	UserId  int64  `json:"user_id,omitempty"`
	Target  string `json:"target"`
	Limit   int64  `json:"limit"`
	Used    int64  `json:"used"`
	Service string `json:"-"`
	Scope   string `json:"-"`
}

func (dto QuotaDTO) Tag() (Tag, error) {
	return NewTag(TargetSrv(dto.Service), Target(dto.Target), Scope(dto.Scope))
}

type UpdateQuotaCmd struct {
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	OrgID  int64  `json:"-"`
	UserID int64  `json:"-"`
}

type NewUsageReporter struct {
	TargetSrv     TargetSrv
	DefaultLimits *Map
	Reporter      UsageReporterFunc
}
