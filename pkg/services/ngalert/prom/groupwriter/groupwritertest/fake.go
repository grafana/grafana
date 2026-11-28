// Package groupwritertest provides a rules API for testing code that uses groupwriter.Writer. Rule
// sequences are kept in memory. Alert and recording rules are written through a legacy rule
// service, the way legacy storage writes them, but without admission.
package groupwritertest

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/common"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

// Clients is a resource.ClientGenerator for the rules API. Every write is appended to Ops as
// "<verb> <Kind> <name>"; callers can append their own writes with Record to check ordering.
type Clients struct {
	Sequences  map[string]*v1beta1.RuleSequence
	Ops        []string
	FailUpdate error
	FailDelete error
	// TerminatingGets keeps a deleted sequence, marked as being deleted, for that many reads, the way
	// the rules app's finalizer keeps it until the deletion is processed.
	TerminatingGets int
	// RuleDelete, when set, is called before a rule is deleted, and an error rejects the delete.
	RuleDelete func(name string) error

	terminating    map[string]int
	alertRules     *legacy.AlertRules
	recordingRules *legacy.RecordingRules
	user           identity.Requester
}

// NewClients returns clients that keep rule sequences only.
func NewClients() *Clients {
	return &Clients{Sequences: map[string]*v1beta1.RuleSequence{}}
}

// NewClientsWithRules returns clients that also write rules through service, as user when the
// context carries no identity.
func NewClientsWithRules(service *legacy.Service, user identity.Requester) *Clients {
	c := NewClients()
	c.alertRules = service.AlertRules()
	c.recordingRules = service.RecordingRules()
	c.user = user
	return c
}

// PersistUpdates makes store apply the rule updates it receives, which the fake store only records.
func PersistUpdates(store *fakes.RuleStore) {
	hook := store.Hook
	store.Hook = func(cmd any) error {
		if updates, ok := cmd.([]models.UpdateRule); ok {
			for _, u := range updates {
				for i, r := range store.Rules[u.New.OrgID] {
					if r.UID == u.New.UID {
						store.Rules[u.New.OrgID][i] = u.New.Copy()
					}
				}
			}
		}
		if hook == nil {
			return nil
		}
		return hook(cmd)
	}
}

func (f *Clients) Record(op string) { f.Ops = append(f.Ops, op) }

func (f *Clients) ClientFor(kind resource.Kind) (resource.Client, error) {
	switch kind.Kind() {
	case v1beta1.RuleSequenceKind().Kind():
		return &sequenceClient{f: f}, nil
	case v1beta1.AlertRuleKind().Kind():
		if f.alertRules == nil {
			return nil, errors.New("rules are not configured")
		}
		return &ruleClient{f: f, kind: kind, ops: alertRuleOps(f.alertRules)}, nil
	case v1beta1.RecordingRuleKind().Kind():
		if f.recordingRules == nil {
			return nil, errors.New("rules are not configured")
		}
		return &ruleClient{f: f, kind: kind, ops: recordingRuleOps(f.recordingRules)}, nil
	}
	return nil, errors.New("unexpected kind " + kind.Kind())
}

func (f *Clients) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, errors.New("not implemented")
}

func (f *Clients) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, errors.New("not implemented")
}

type sequenceClient struct {
	resource.Client
	f *Clients
}

func (c *sequenceClient) Get(_ context.Context, id resource.Identifier) (resource.Object, error) {
	f := c.f
	seq, ok := f.Sequences[id.Name]
	if !ok {
		return nil, notFound(v1beta1.RuleSequenceKind(), id.Name)
	}
	if n, ok := f.terminating[id.Name]; ok {
		if n == 0 {
			delete(f.terminating, id.Name)
			delete(f.Sequences, id.Name)
			return nil, notFound(v1beta1.RuleSequenceKind(), id.Name)
		}
		f.terminating[id.Name] = n - 1
	}
	return seq.Copy(), nil
}

func (c *sequenceClient) Create(_ context.Context, id resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	c.f.Record("create RuleSequence " + id.Name)
	c.f.Sequences[id.Name] = obj.Copy().(*v1beta1.RuleSequence)
	return obj, nil
}

func (c *sequenceClient) Update(_ context.Context, id resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	if c.f.FailUpdate != nil {
		return nil, c.f.FailUpdate
	}
	c.f.Record("update RuleSequence " + id.Name)
	c.f.Sequences[id.Name] = obj.Copy().(*v1beta1.RuleSequence)
	return obj, nil
}

func (c *sequenceClient) Delete(_ context.Context, id resource.Identifier, _ resource.DeleteOptions) error {
	f := c.f
	if f.FailDelete != nil {
		return f.FailDelete
	}
	if _, ok := f.Sequences[id.Name]; !ok {
		return notFound(v1beta1.RuleSequenceKind(), id.Name)
	}
	f.Record("delete RuleSequence " + id.Name)
	if f.TerminatingGets == 0 {
		delete(f.Sequences, id.Name)
		return nil
	}
	if f.terminating == nil {
		f.terminating = map[string]int{}
	}
	f.terminating[id.Name] = f.TerminatingGets
	f.Sequences[id.Name].DeletionTimestamp = &metav1.Time{Time: time.Now()}
	return nil
}

type ruleOps struct {
	get    func(ctx context.Context, user identity.Requester, name string) (resource.Object, error)
	list   func(ctx context.Context, user identity.Requester, opts legacy.ListAlertRulesOptions) (resource.ListObject, error)
	create func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error)
	update func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error)
	delete func(ctx context.Context, user identity.Requester, obj resource.Object) error
}

func alertRuleOps(r *legacy.AlertRules) ruleOps {
	return ruleOps{
		get: func(ctx context.Context, user identity.Requester, name string) (resource.Object, error) {
			return r.Get(ctx, user, user.GetOrgID(), name)
		},
		list: func(ctx context.Context, user identity.Requester, opts legacy.ListAlertRulesOptions) (resource.ListObject, error) {
			return r.List(ctx, user, user.GetOrgID(), opts)
		},
		create: func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error) {
			return r.Create(ctx, user, user.GetOrgID(), obj.(*v1beta1.AlertRule), false)
		},
		update: func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error) {
			return r.Update(ctx, user, user.GetOrgID(), obj.(*v1beta1.AlertRule), false)
		},
		delete: func(ctx context.Context, user identity.Requester, obj resource.Object) error {
			return r.Delete(ctx, user, user.GetOrgID(), obj.(*v1beta1.AlertRule), false)
		},
	}
}

func recordingRuleOps(r *legacy.RecordingRules) ruleOps {
	return ruleOps{
		get: func(ctx context.Context, user identity.Requester, name string) (resource.Object, error) {
			return r.Get(ctx, user, user.GetOrgID(), name)
		},
		list: func(ctx context.Context, user identity.Requester, opts legacy.ListAlertRulesOptions) (resource.ListObject, error) {
			return r.List(ctx, user, user.GetOrgID(), opts)
		},
		create: func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error) {
			return r.Create(ctx, user, user.GetOrgID(), obj.(*v1beta1.RecordingRule), false)
		},
		update: func(ctx context.Context, user identity.Requester, obj resource.Object) (resource.Object, error) {
			return r.Update(ctx, user, user.GetOrgID(), obj.(*v1beta1.RecordingRule), false)
		},
		delete: func(ctx context.Context, user identity.Requester, obj resource.Object) error {
			return r.Delete(ctx, user, user.GetOrgID(), obj.(*v1beta1.RecordingRule), false)
		},
	}
}

type ruleClient struct {
	resource.Client
	f    *Clients
	kind resource.Kind
	ops  ruleOps
}

func (c *ruleClient) requester(ctx context.Context) identity.Requester {
	if user, err := identity.GetRequester(ctx); err == nil {
		return user
	}
	return c.f.user
}

func (c *ruleClient) apiError(name string, err error) error {
	if err == nil {
		return nil
	}
	return common.ToAPIError(c.kind.GroupVersionResource().GroupResource(), name, err)
}

func (c *ruleClient) Get(ctx context.Context, id resource.Identifier) (resource.Object, error) {
	obj, err := c.ops.get(ctx, c.requester(ctx), id.Name)
	return obj, c.apiError(id.Name, err)
}

// List supports the folder label selector only.
func (c *ruleClient) List(ctx context.Context, _ string, opts resource.ListOptions) (resource.ListObject, error) {
	var filter legacy.ListAlertRulesOptions
	for _, f := range opts.LabelFilters {
		if key, value, ok := strings.Cut(f, "="); ok && key == v1beta1.FolderLabelKey {
			filter.FolderFilter.Include = []string{value}
		}
	}
	list, err := c.ops.list(ctx, c.requester(ctx), filter)
	return list, c.apiError("", err)
}

func (c *ruleClient) Create(ctx context.Context, id resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	c.f.Record("create " + c.kind.Kind() + " " + id.Name)
	created, err := c.ops.create(ctx, c.requester(ctx), obj)
	return created, c.apiError(id.Name, err)
}

func (c *ruleClient) Update(ctx context.Context, id resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	c.f.Record("update " + c.kind.Kind() + " " + id.Name)
	// The fake rule store doesn't version rules, and legacy storage rejects a zero resourceVersion.
	if obj.GetResourceVersion() == "0" {
		obj.SetResourceVersion("")
	}
	updated, err := c.ops.update(ctx, c.requester(ctx), obj)
	return updated, c.apiError(id.Name, err)
}

func (c *ruleClient) Delete(ctx context.Context, id resource.Identifier, _ resource.DeleteOptions) error {
	if c.f.RuleDelete != nil {
		if err := c.f.RuleDelete(id.Name); err != nil {
			return err
		}
	}
	user := c.requester(ctx)
	obj, err := c.ops.get(ctx, user, id.Name)
	if err != nil {
		return c.apiError(id.Name, err)
	}
	c.f.Record("delete " + c.kind.Kind() + " " + id.Name)
	return c.apiError(id.Name, c.ops.delete(ctx, user, obj))
}

func notFound(kind resource.Kind, name string) error {
	return apierrors.NewNotFound(kind.GroupVersionResource().GroupResource(), name)
}
