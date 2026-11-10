package source

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

const (
	requestTimeout        = 30 * time.Second
	defaultDescriptorTTL  = 5 * time.Minute
	defaultPageSize       = 1000
	defaultMaxFileBytes   = 5 << 20
	maxErrorBodyBytes     = 64 << 10
	maxDescriptorBodySize = 16 << 20
)

var (
	// ErrNotSupported means the source does not implement the requested capability.
	ErrNotSupported = errors.New("source does not support this operation")
	// ErrSourceNotFound means the source id is unknown to the server.
	ErrSourceNotFound error = &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusNotFound,
		Reason:  metav1.StatusReasonNotFound,
		Message: "source not found",
	}}
	// ErrEmptyTree means the source returned no files for a repository that manages resources.
	// Syncing it would delete all of them; set spec.source.emptyTreePolicy to allow to do that on purpose.
	ErrEmptyTree = errors.New("source returned an empty tree for a repository that manages resources")
	// ErrIncompleteTree means the source returned a tree that is not marked complete.
	// Syncing it would prune everything that was cut off.
	ErrIncompleteTree = errors.New("source returned an incomplete tree")
)

// State is what survives between short-lived repository builds for one source URL:
// the cached descriptor and the last revision, which makes an idle tick one conditional request.
type State struct {
	mu                sync.Mutex
	descriptor        *sourcev1.Descriptor
	descriptorExpires time.Time
	revision          string
}

// Client talks to one source. It is cheap to create; share State to keep the caches warm.
type Client struct {
	base    string
	auth    Authenticator
	agent   string
	http    *http.Client
	state   *State
	nowFunc func() time.Time
}

// Authenticator signs outgoing requests.
type Authenticator interface {
	Authenticate(ctx context.Context, req *http.Request) error
}

type ClientOptions struct {
	// Auth signs every request; nil sends them unauthenticated.
	Auth Authenticator
	// Version is reported in the User-Agent.
	Version string
	// HTTPClient overrides the default client (CA bundle, proxy, mTLS).
	HTTPClient *http.Client
	// State shares caches across clients of the same source.
	State *State
}

func NewClient(base string, opts ClientOptions) *Client {
	hc := opts.HTTPClient
	if hc == nil {
		hc = &http.Client{}
	}
	hc = &http.Client{
		Transport: hc.Transport,
		Jar:       hc.Jar,
		Timeout:   requestTimeout,
		// A redirect could carry the token to another host.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}

	state := opts.State
	if state == nil {
		state = &State{}
	}
	version := opts.Version
	if version == "" {
		version = "dev"
	}

	return &Client{
		base:    strings.TrimRight(base, "/"),
		auth:    opts.Auth,
		agent:   "grafana-provisioning/" + version,
		http:    hc,
		state:   state,
		nowFunc: time.Now,
	}
}

// Descriptor returns the cached descriptor, refreshing it once its max-age has passed.
func (c *Client) Descriptor(ctx context.Context, refresh bool) (*sourcev1.Descriptor, error) {
	c.state.mu.Lock()
	defer c.state.mu.Unlock()

	if !refresh && c.state.descriptor != nil && c.nowFunc().Before(c.state.descriptorExpires) {
		return c.state.descriptor, nil
	}

	resp, err := c.get(ctx, "", nil, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	d := &sourcev1.Descriptor{}
	if err := decode(resp.Body, d); err != nil {
		return nil, fmt.Errorf("decode source descriptor: %w", err)
	}
	if d.GetApiVersion() != sourcev1.APIVersion {
		return nil, fmt.Errorf("unsupported source apiVersion %q, want %q", d.GetApiVersion(), sourcev1.APIVersion)
	}

	c.state.descriptor = d
	c.state.descriptorExpires = c.nowFunc().Add(maxAge(resp.Header.Get("Cache-Control")))
	return d, nil
}

// Revision returns the current revision. After the first call it sends If-None-Match,
// so an unchanged source answers 304 and nothing else is read.
func (c *Client) Revision(ctx context.Context) (string, error) {
	c.state.mu.Lock()
	last := c.state.revision
	c.state.mu.Unlock()

	header := http.Header{}
	if last != "" {
		header.Set("If-None-Match", `"`+last+`"`)
	}

	resp, err := c.get(ctx, "/revision", nil, header)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotModified {
		return last, nil
	}

	r := &sourcev1.GetRevisionResponse{}
	if err := decode(resp.Body, r); err != nil {
		return "", fmt.Errorf("decode revision: %w", err)
	}
	if !revisionPattern.MatchString(r.GetRevision()) {
		return "", fmt.Errorf("source returned an invalid revision %q", r.GetRevision())
	}

	c.state.mu.Lock()
	c.state.revision = r.GetRevision()
	c.state.mu.Unlock()
	return r.GetRevision(), nil
}

// Tree reads every page of the tree. The first page pins the revision when none is given,
// and later pages ask for that same snapshot.
func (c *Client) Tree(ctx context.Context, revision string, limits *sourcev1.Limits) (string, []*sourcev1.TreeEntry, error) {
	pageSize := int(limits.GetMaxPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}

	var entries []*sourcev1.TreeEntry
	cursor := ""
	for {
		query := url.Values{"limit": {strconv.Itoa(pageSize)}}
		if revision != "" {
			query.Set("revision", revision)
		}
		if cursor != "" {
			query.Set("cursor", cursor)
		}

		page := &sourcev1.GetTreeResponse{}
		if err := c.getMessage(ctx, "/tree", query, page); err != nil {
			return "", nil, err
		}

		revision = page.GetRevision()
		entries = append(entries, page.GetEntries()...)
		if max := int(limits.GetMaxFiles()); max > 0 && len(entries) > max {
			return "", nil, fmt.Errorf("source tree exceeds its own limit of %d files", max)
		}

		if page.GetNextCursor() == "" {
			if !page.GetComplete() {
				return "", nil, ErrIncompleteTree
			}
			return revision, entries, nil
		}
		cursor = page.GetNextCursor()
	}
}

// TreeEmpty reports whether a revision has no files, reading a single entry.
func (c *Client) TreeEmpty(ctx context.Context, revision string) (bool, error) {
	query := url.Values{"limit": {"1"}}
	if revision != "" {
		query.Set("revision", revision)
	}

	page := &sourcev1.GetTreeResponse{}
	if err := c.getMessage(ctx, "/tree", query, page); err != nil {
		return false, err
	}
	return len(page.GetEntries()) == 0 && page.GetComplete(), nil
}

// File reads one file. An empty revision means the current one.
func (c *Client) File(ctx context.Context, path, revision string, maxBytes int64) ([]byte, string, error) {
	if maxBytes <= 0 {
		maxBytes = defaultMaxFileBytes
	}

	var query url.Values
	if revision != "" {
		query = url.Values{"revision": {revision}}
	}

	resp, err := c.get(ctx, "/files/"+escapePath(path), query, nil)
	if err != nil {
		return nil, "", err
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("read file %q: %w", path, err)
	}
	if int64(len(data)) > maxBytes {
		return nil, "", apierrors.NewRequestEntityTooLargeError(
			fmt.Sprintf("file %q exceeds the limit of %d bytes", path, maxBytes))
	}

	return data, strings.Trim(resp.Header.Get("ETag"), `"`), nil
}

// Compare reads every page of changes between two revisions.
func (c *Client) Compare(ctx context.Context, base, head string) ([]*sourcev1.Change, error) {
	var changes []*sourcev1.Change
	cursor := ""
	for {
		query := url.Values{"base": {base}, "head": {head}}
		if cursor != "" {
			query.Set("cursor", cursor)
		}

		page := &sourcev1.CompareResponse{}
		if err := c.getMessage(ctx, "/compare", query, page); err != nil {
			return nil, err
		}

		changes = append(changes, page.GetChanges()...)
		if page.GetNextCursor() == "" {
			if !page.GetComplete() {
				return nil, fmt.Errorf("source returned an incomplete compare")
			}
			return changes, nil
		}
		cursor = page.GetNextCursor()
	}
}

func (c *Client) getMessage(ctx context.Context, path string, query url.Values, out proto.Message) error {
	resp, err := c.get(ctx, path, query, nil)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if err := decode(resp.Body, out); err != nil {
		return fmt.Errorf("decode %s response: %w", path, err)
	}
	return nil
}

// decode reads protobuf JSON. Unknown fields are ignored so the contract can grow additively.
func decode(r io.Reader, out proto.Message) error {
	data, err := io.ReadAll(io.LimitReader(r, maxDescriptorBodySize))
	if err != nil {
		return err
	}
	return protojson.UnmarshalOptions{DiscardUnknown: true}.Unmarshal(data, out)
}

// get returns the response for 200 and 304; every other status becomes an error.
func (c *Client) get(ctx context.Context, path string, query url.Values, header http.Header) (*http.Response, error) {
	u := c.base + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("build source request: %w", err)
	}
	req.Header.Set("User-Agent", c.agent)
	req.Header.Set("Accept", "application/json")
	if c.auth != nil {
		if err := c.auth.Authenticate(ctx, req); err != nil {
			return nil, fmt.Errorf("authenticate source request: %w", err)
		}
	}
	for k, v := range header {
		req.Header[k] = v
	}

	resp, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, fmt.Errorf("%w: %w", repository.ErrServerUnavailable, err)
	}

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotModified {
		return resp, nil
	}
	defer func() { _ = resp.Body.Close() }()
	return nil, errorFromResponse(resp)
}

// errorFromResponse maps the Source API error table onto Provisioning's repository errors.
func errorFromResponse(resp *http.Response) error {
	body := &sourcev1.Error{}
	if data, err := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes)); err == nil {
		_ = protojson.UnmarshalOptions{DiscardUnknown: true}.Unmarshal(data, body)
	}
	detail := body.GetMessage()
	if detail == "" {
		detail = http.StatusText(resp.StatusCode)
	}

	var sentinel error
	switch {
	case resp.StatusCode == http.StatusBadRequest:
		return apierrors.NewBadRequest(detail)
	case resp.StatusCode == http.StatusUnauthorized:
		sentinel = repository.ErrUnauthorized
	case resp.StatusCode == http.StatusForbidden:
		sentinel = repository.ErrPermissionDenied
	case resp.StatusCode == http.StatusNotFound && body.GetCode() == sourcev1.CodeSourceNotFound:
		sentinel = ErrSourceNotFound
	case resp.StatusCode == http.StatusNotFound && body.GetCode() == sourcev1.CodeRevisionNotFound,
		resp.StatusCode == http.StatusGone:
		sentinel = repository.ErrRefNotFound
	case resp.StatusCode == http.StatusNotFound:
		sentinel = repository.ErrFileNotFound
	case resp.StatusCode == http.StatusTooManyRequests:
		sentinel = repository.ErrTooManyRequests
	case resp.StatusCode == http.StatusNotImplemented:
		sentinel = ErrNotSupported
	case resp.StatusCode >= 500:
		sentinel = repository.ErrServerUnavailable
	default:
		return fmt.Errorf("source returned unexpected status %d: %s", resp.StatusCode, detail)
	}
	return fmt.Errorf("%s: %w", detail, sentinel)
}

// maxAge reads max-age from a Cache-Control header, falling back to the default.
func maxAge(cacheControl string) time.Duration {
	for _, directive := range strings.Split(cacheControl, ",") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(directive), "max-age="); ok {
			if secs, err := strconv.Atoi(v); err == nil && secs >= 0 {
				return time.Duration(secs) * time.Second
			}
		}
	}
	return defaultDescriptorTTL
}

func escapePath(p string) string {
	segments := strings.Split(p, "/")
	for i, s := range segments {
		segments[i] = url.PathEscape(s)
	}
	return strings.Join(segments, "/")
}
