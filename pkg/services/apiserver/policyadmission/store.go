package policyadmission

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	policyapp "github.com/grafana/grafana/apps/policy/pkg/app"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
)

// paramsTimeout bounds reading a parameter object while admitting a request.
const paramsTimeout = 5 * time.Second

// store keeps an engine.Set per namespace, built from the ValidationPolicy and
// ValidationPolicyBinding resources of that namespace.
type store struct {
	log       log.Logger
	metrics   *metrics
	compiler  *engine.Compiler
	resources map[schema.GroupVersionKind]schema.GroupVersionResource

	synced   atomic.Bool
	dyn      dynamic.Interface
	policies cache.GenericLister
	bindings cache.GenericLister

	mu sync.Mutex
	// compiled caches compiled policies by content, so the identical policies that apps write
	// into every namespace are compiled once.
	compiled map[string]compileResult
	// sets caches each namespace's set until its policies or bindings change.
	sets map[string]namespaceSet
}

type compileResult struct {
	policy *engine.CompiledPolicy
	err    error
}

type namespaceSet struct {
	fingerprint string
	set         *engine.Set
}

func newStore(logger log.Logger, m *metrics, compiler *engine.Compiler, resources map[schema.GroupVersionKind]schema.GroupVersionResource) *store {
	return &store{
		log:       logger,
		metrics:   m,
		compiler:  compiler,
		resources: resources,
		compiled:  map[string]compileResult{},
		sets:      map[string]namespaceSet{},
	}
}

// start begins watching policies and bindings. It does not wait for the initial list, so it never
// delays server startup; until the watches sync, no policies are enforced.
func (s *store) start(ctx context.Context, cfg *rest.Config) error {
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return fmt.Errorf("creating dynamic client: %w", err)
	}
	s.dyn = dyn

	factory := dynamicinformer.NewDynamicSharedInformerFactory(dyn, 0)
	policies := factory.ForResource(policyv0alpha1.ValidationPolicyKind().GroupVersionResource())
	bindings := factory.ForResource(policyv0alpha1.ValidationPolicyBindingKind().GroupVersionResource())
	s.policies, s.bindings = policies.Lister(), bindings.Lister()
	factory.Start(ctx.Done())

	go func() {
		if cache.WaitForCacheSync(ctx.Done(), policies.Informer().HasSynced, bindings.Informer().HasSynced) {
			s.synced.Store(true)
			s.log.Info("Validation policies synced")
		}
	}()
	return nil
}

// SetFor implements admission.SetProvider.
func (s *store) SetFor(_ context.Context, namespace string) (*engine.Set, error) {
	if !s.synced.Load() {
		return nil, nil
	}
	policyObjs, err := s.policies.ByNamespace(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	bindingObjs, err := s.bindings.ByNamespace(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	if len(policyObjs) == 0 || len(bindingObjs) == 0 {
		return nil, nil
	}

	fp := fingerprint(policyObjs, bindingObjs)
	s.mu.Lock()
	defer s.mu.Unlock()
	if cached, ok := s.sets[namespace]; ok && cached.fingerprint == fp {
		return cached.set, nil
	}

	compiled := map[string]*engine.CompiledPolicy{}
	for _, obj := range policyObjs {
		p := &policyv0alpha1.ValidationPolicy{}
		if err := fromUnstructured(obj, p); err != nil {
			s.log.Warn("Skipping unreadable validation policy", "namespace", namespace, "error", err)
			continue
		}
		cp, err := s.compileLocked(policyapp.ToPolicy(p))
		if err != nil {
			s.log.Warn("Skipping validation policy that does not compile", "namespace", namespace, "policy", p.Name, "error", err)
			continue
		}
		compiled[p.Name] = cp
	}

	var bindings []api.Binding
	for _, obj := range bindingObjs {
		b := &policyv0alpha1.ValidationPolicyBinding{}
		if err := fromUnstructured(obj, b); err != nil {
			s.log.Warn("Skipping unreadable validation policy binding", "namespace", namespace, "error", err)
			continue
		}
		binding := policyapp.ToBinding(b)
		if reason := unusable(binding, compiled); reason != "" {
			s.log.Debug("Skipping validation policy binding", "namespace", namespace, "binding", b.Name, "reason", reason)
			continue
		}
		bindings = append(bindings, binding)
	}

	policies := make([]*engine.CompiledPolicy, 0, len(compiled))
	for _, cp := range compiled {
		policies = append(policies, cp)
	}
	set, err := engine.NewSet(policies, bindings, s)
	if err != nil {
		return nil, err
	}
	s.sets[namespace] = namespaceSet{fingerprint: fp, set: set}
	return set, nil
}

// compile compiles a policy, reusing the result for policies with identical content.
func (s *store) compile(p api.Policy) (*engine.CompiledPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.compileLocked(p)
}

func (s *store) compileLocked(p api.Policy) (*engine.CompiledPolicy, error) {
	raw, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(raw)
	key := hex.EncodeToString(sum[:])
	r, ok := s.compiled[key]
	s.metrics.compileLookup(ok)
	if ok {
		return r.policy, r.err
	}
	cp, err := s.compiler.Compile(p)
	s.compiled[key] = compileResult{policy: cp, err: err}
	s.metrics.compiled(err, len(s.compiled))
	return cp, err
}

// unusable explains why a binding cannot be part of a set, or returns "" when it can.
func unusable(b api.Binding, compiled map[string]*engine.CompiledPolicy) string {
	if errs := b.Validate(); len(errs) > 0 {
		return errs.ToAggregate().Error()
	}
	cp, ok := compiled[b.PolicyName]
	if !ok {
		return "policy does not exist or does not compile"
	}
	if _, hasParams := cp.ParamGVK(); hasParams && b.ParamRef == nil {
		return "policy requires paramRef"
	}
	return ""
}

// GetParams implements engine.ParamSource. The parameter object is read as the API server's
// loopback user rather than the requester, who need not be allowed to read it.
func (s *store) GetParams(ctx context.Context, gvk schema.GroupVersionKind, namespace, name string) (map[string]any, error) {
	gvr, ok := s.resources[gvk]
	if !ok {
		return nil, fmt.Errorf("unknown param kind %s", gvk)
	}
	// A fresh context carries no requester, so the loopback client authenticates as itself.
	readCtx, cancel := context.WithTimeout(context.Background(), paramsTimeout)
	defer cancel()
	stop := context.AfterFunc(ctx, cancel)
	defer stop()

	obj, err := s.dyn.Resource(gvr).Namespace(namespace).Get(readCtx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, engine.ErrParamsNotFound
	}
	if err != nil {
		return nil, err
	}
	return obj.Object, nil
}

func fromUnstructured(obj runtime.Object, into any) error {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("unexpected object type %T", obj)
	}
	return runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, into)
}

// fingerprint identifies the exact versions of a namespace's policies and bindings.
func fingerprint(policies, bindings []runtime.Object) string {
	keys := make([]string, 0, len(policies)+len(bindings))
	for prefix, objs := range map[string][]runtime.Object{"p/": policies, "b/": bindings} {
		for _, obj := range objs {
			if u, ok := obj.(*unstructured.Unstructured); ok {
				keys = append(keys, prefix+u.GetName()+"@"+u.GetResourceVersion())
			}
		}
	}
	slices.Sort(keys)
	return strings.Join(keys, ",")
}
