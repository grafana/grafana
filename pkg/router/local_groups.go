package router

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	// routerOriginHeader marks a request that the multi-tenant router (originMT)
	// or a single-tenant stack (originST) forwarded to the other side for a
	// group it does not serve. Each side forwards what it does not serve to the
	// other, so without the mark a group neither serves would bounce between
	// them: a request that already crossed is refused rather than sent again.
	// It also tells discovery what to leave out: the router answers a request
	// from a stack with only its own groups, and a stack answers the router's
	// with only its own, which stops discovery from recursing.
	//
	// The edge should drop the header from public traffic. Anyone who sets it
	// only narrows their own discovery and makes their own fallbacks refuse. Any
	// value refuses; the discovery rules also read the values originMT and originST.
	routerOriginHeader = "X-Grafana-Router-Origin"
	originMT           = "mt"
	originST           = "st"
)

// localGroups is the set of API groups the embedded API server answers for,
// including groups the embedded kube-aggregator proxies to remote services. On
// a single-tenant Grafana that set is fixed once the server is ready, so it is
// read once, never polled.
type localGroups struct {
	// groups is nil until the snapshot succeeds.
	groups   atomic.Pointer[map[string]struct{}]
	cooldown *cooldown

	// onLoaded, when set before the first load, is called after each snapshot.
	onLoaded func()
}

func newLocalGroups() *localGroups {
	return &localGroups{cooldown: newCooldown(defaultAggregateMinBackoff, defaultAggregateMinBackoff, defaultAggregateMaxBackoff)}
}

// absent reports whether group is certainly not served locally. Until the
// snapshot succeeds nothing is known, so nothing is absent: requests stay with
// the embedded API server rather than risk sending a local group away.
func (l *localGroups) absent(group string) bool {
	groups := l.groups.Load()
	if groups == nil {
		return false
	}
	_, ok := (*groups)[group]
	return !ok
}

// run takes the snapshot, retrying with backoff until it succeeds or ctx is done.
func (l *localGroups) run(ctx context.Context, client *http.Client, baseURL string) {
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			err := l.load(ctx, client, baseURL)
			if err == nil {
				return
			}
			now := time.Now()
			l.cooldown.OnFailure(now)
			if errors.Is(err, errAPIServerNotReady) {
				logging.FromContext(ctx).Debug("router: waiting for the embedded API server before reading its groups", "err", err)
			} else {
				logging.FromContext(ctx).Warn("router: reading the embedded API server's groups failed, retrying", "err", err)
			}
			timer.Reset(l.cooldown.Until(now))
		}
	}
}

var errAPIServerNotReady = errors.New("router: embedded API server is not ready")

const apiServicesPath = "/apis/apiregistration.k8s.io/v1/apiservices"

// load stores the groups served once the API server is ready. Ready means the
// boot-sequence checks passed, which is when the aggregator has registered its
// local and remote APIServices. Discovery lists a remote group only while its
// service is available, but the group must stay with the aggregator, which
// answers for it, so the APIService objects count too.
func (l *localGroups) load(ctx context.Context, client *http.Client, baseURL string) error {
	baseURL = strings.TrimSuffix(baseURL, "/")
	if err := getOK(ctx, client, baseURL+"/readyz"); err != nil {
		return fmt.Errorf("%w: %w", errAPIServerNotReady, err)
	}

	discovered, err := discoverGroupResources(ctx, client, baseURL)
	if err != nil {
		return err
	}
	groups := make(map[string]struct{}, len(discovered))
	for _, d := range discovered {
		groups[d.group.Name] = struct{}{}
	}

	services, err := apiServiceGroups(ctx, client, baseURL+apiServicesPath)
	if err != nil {
		return err
	}
	for _, group := range services {
		groups[group] = struct{}{}
	}
	l.groups.Store(&groups)
	if l.onLoaded != nil {
		l.onLoaded()
	}
	return nil
}

func getOK(ctx context.Context, client *http.Client, url string) error {
	// #nosec G704 -- url is the embedded API server's loopback address.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	// #nosec G704 -- req targets the loopback address above.
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<10))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned status %d", url, resp.StatusCode)
	}
	return nil
}

// apiServiceGroups lists the groups of the aggregator's APIServices. Without
// the aggregator the API does not exist, which leaves no groups to add.
func apiServiceGroups(ctx context.Context, client *http.Client, url string) ([]string, error) {
	// #nosec G704 -- url is the embedded API server's loopback address.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	// #nosec G704 -- req targets the loopback address above.
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, nil
	default:
		return nil, fmt.Errorf("listing APIServices returned status %d", resp.StatusCode)
	}
	var list apiregistrationv1.APIServiceList
	if err := decodeLimitedJSON(resp.Body, int64(maxDiscoveryDocBytes), &list); err != nil {
		return nil, fmt.Errorf("decoding APIServiceList: %w", err)
	}
	groups := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		groups = append(groups, item.Spec.Group)
	}
	return groups, nil
}

// crossed reports whether req carries the origin header, with any value: it
// already crossed between the multi-tenant router and a stack, or someone
// claims it did, and either way it is not sent across again.
func crossed(req *http.Request) bool {
	return req.Header.Get(routerOriginHeader) != ""
}
