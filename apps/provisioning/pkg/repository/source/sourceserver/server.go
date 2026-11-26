// Package sourceserver is a reference implementation of the Source API server side.
// It implements the generated sourcev1.SourceServiceServer over content-addressed
// in-memory snapshots, can advertise any capability tier, and serves the REST binding
// through the generated gateway. It is the fixture for Provisioning tests and a
// stand-in for a real source.
package sourceserver

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"slices"
	"strings"
	"sync"

	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"

	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

// Tier selects which capabilities the server advertises.
type Tier int

const (
	// TierTree serves tree and files only.
	TierTree Tier = iota
	// TierRevision adds the revision endpoint.
	TierRevision
	// TierHistory adds retained revisions, so clients can diff trees themselves.
	TierHistory
	// TierCompare adds the server-side compare endpoint.
	TierCompare
)

type Options struct {
	// ID is the only source id served. Any other id is a 404.
	ID   string
	Tier Tier
	// Token is the required bearer token; empty disables authentication.
	Token string
	// Retained is how many revisions are kept at TierHistory and above (default 5).
	Retained int
	// MaxPageSize caps page sizes (default 1000).
	MaxPageSize int
	// Writable advertises and serves the write capability, so the source can be edited.
	Writable bool
	// Persist is called with the whole tree before an edit is published; an error aborts the edit.
	Persist func(files map[string][]byte) error
}

type file struct {
	data []byte
	hash string
}

type snapshot struct {
	revision string
	files    map[string]file
}

var _ sourcev1.SourceServiceServer = (*Server)(nil)

type Server struct {
	opts Options

	// writeMu serializes edits, which read the current tree and publish a new one.
	writeMu sync.Mutex

	mu        sync.RWMutex
	snapshots []snapshot // oldest first; the last one is current
	seen      map[string]struct{}
}

func New(opts Options) *Server {
	if opts.Retained <= 0 {
		opts.Retained = 5
	}
	if opts.MaxPageSize <= 0 {
		opts.MaxPageSize = 1000
	}
	s := &Server{opts: opts, seen: map[string]struct{}{}}
	s.Publish(nil)
	return s
}

// Publish makes files (path to content) the current tree and returns its revision.
// Publishing identical content again is a no-op, so the revision only moves on change.
func (s *Server) Publish(files map[string][]byte) string {
	snap := snapshot{files: make(map[string]file, len(files))}
	paths := make([]string, 0, len(files))
	for p, data := range files {
		snap.files[p] = file{data: data, hash: hashOf(data)}
		paths = append(paths, p)
	}
	slices.Sort(paths)

	h := sha256.New()
	for _, p := range paths {
		h.Write([]byte(p + "\x00" + snap.files[p].hash + "\n"))
	}
	snap.revision = hex.EncodeToString(h.Sum(nil))[:16]

	s.mu.Lock()
	defer s.mu.Unlock()
	if n := len(s.snapshots); n > 0 && s.snapshots[n-1].revision == snap.revision {
		return snap.revision
	}
	s.snapshots = append(s.snapshots, snap)
	s.seen[snap.revision] = struct{}{}
	if keep := s.retained(); len(s.snapshots) > keep {
		s.snapshots = s.snapshots[len(s.snapshots)-keep:]
	}
	return snap.revision
}

func hashOf(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// Files returns a copy of the current tree, path to content.
func (s *Server) Files() map[string][]byte {
	head := s.current()
	files := make(map[string][]byte, len(head.files))
	for p, f := range head.files {
		files[p] = f.data
	}
	return files
}

func (s *Server) retained() int {
	if s.opts.Tier < TierHistory {
		return 1
	}
	return s.opts.Retained
}

// Handler serves the REST binding, behind bearer authentication when a token is set.
func (s *Server) Handler() http.Handler {
	api := NewHandler(s)
	if s.opts.Token == "" {
		return api
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// A caller that exchanged a token sends it in X-Access-Token instead of Authorization.
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if got == "" {
			got = strings.TrimPrefix(r.Header.Get("X-Access-Token"), "Bearer ")
		}
		if subtle.ConstantTimeCompare([]byte(got), []byte(s.opts.Token)) != 1 {
			writeError(w, fail(codes.Unauthenticated, sourcev1.CodeUnauthorized, "invalid or missing token"))
			return
		}
		api.ServeHTTP(w, r)
	})
}

func (s *Server) GetDescriptor(ctx context.Context, req *sourcev1.GetDescriptorRequest) (*sourcev1.Descriptor, error) {
	if err := s.checkID(req.GetId()); err != nil {
		return nil, err
	}

	caps := &sourcev1.Capabilities{
		Revision: s.opts.Tier >= TierRevision,
		Compare:  s.opts.Tier >= TierCompare,
		Write:    s.opts.Writable,
		Secrets:  []string{"inline"},
	}
	if s.opts.Tier >= TierHistory {
		caps.History = &sourcev1.History{Retained: int32(s.opts.Retained)}
	}

	_ = grpc.SetHeader(ctx, metadata.Pairs("cache-control", "max-age=300"))
	return &sourcev1.Descriptor{
		ApiVersion:   sourcev1.APIVersion,
		Id:           s.opts.ID,
		Capabilities: caps,
		Limits:       &sourcev1.Limits{MaxFiles: 5000, MaxFileBytes: maxFileBytes, MaxPageSize: int32(s.opts.MaxPageSize)},
	}, nil
}

func (s *Server) GetRevision(ctx context.Context, req *sourcev1.GetRevisionRequest) (*sourcev1.GetRevisionResponse, error) {
	if err := s.checkID(req.GetId()); err != nil {
		return nil, err
	}
	if s.opts.Tier < TierRevision {
		return nil, fail(codes.Unimplemented, sourcev1.CodeNotSupported, "revision is not supported")
	}

	rev := s.current().revision
	etag := `"` + rev + `"`
	header := metadata.Pairs("etag", etag)
	if md, ok := metadata.FromIncomingContext(ctx); ok && slices.Contains(md.Get(ifNoneMatchKey), etag) {
		header.Set(statusKey, "304")
		_ = grpc.SetHeader(ctx, header)
		return &sourcev1.GetRevisionResponse{}, nil
	}
	_ = grpc.SetHeader(ctx, header)
	return &sourcev1.GetRevisionResponse{Revision: rev}, nil
}

func (s *Server) GetTree(_ context.Context, req *sourcev1.GetTreeRequest) (*sourcev1.GetTreeResponse, error) {
	if err := s.checkID(req.GetId()); err != nil {
		return nil, err
	}
	snap, err := s.resolve(req.GetRevision())
	if err != nil {
		return nil, err
	}

	paths, next := page(sortedPaths(snap.files), req.GetCursor(), s.pageSize(req.GetLimit()))
	entries := make([]*sourcev1.TreeEntry, 0, len(paths))
	for _, p := range paths {
		f := snap.files[p]
		entries = append(entries, &sourcev1.TreeEntry{Path: p, Hash: f.hash, Size: int32(len(f.data))})
	}
	return &sourcev1.GetTreeResponse{Revision: snap.revision, Complete: next == "", Entries: entries, NextCursor: next}, nil
}

func (s *Server) GetFile(ctx context.Context, req *sourcev1.GetFileRequest) (*httpbody.HttpBody, error) {
	if err := s.checkID(req.GetId()); err != nil {
		return nil, err
	}
	snap, err := s.resolve(req.GetRevision())
	if err != nil {
		return nil, err
	}

	f, found := snap.files[req.GetPath()]
	if !found {
		return nil, fail(codes.NotFound, sourcev1.CodeFileNotFound, "no such file "+req.GetPath())
	}

	// Files carry secrets.
	_ = grpc.SetHeader(ctx, metadata.Pairs("cache-control", "no-store", "etag", `"`+f.hash+`"`))
	return &httpbody.HttpBody{ContentType: "application/octet-stream", Data: f.data}, nil
}

func (s *Server) Compare(_ context.Context, req *sourcev1.CompareRequest) (*sourcev1.CompareResponse, error) {
	if err := s.checkID(req.GetId()); err != nil {
		return nil, err
	}
	if s.opts.Tier < TierCompare {
		return nil, fail(codes.Unimplemented, sourcev1.CodeNotSupported, "compare is not supported")
	}

	base, err := s.resolve(req.GetBase())
	if err != nil {
		return nil, err
	}
	head, err := s.resolve(req.GetHead())
	if err != nil {
		return nil, err
	}

	var changes []*sourcev1.Change
	for _, p := range sortedPaths(head.files) {
		old, existed := base.files[p]
		switch {
		case !existed:
			changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionCreated, Path: p})
		case old.hash != head.files[p].hash:
			changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionUpdated, Path: p})
		}
	}
	for _, p := range sortedPaths(base.files) {
		if _, still := head.files[p]; !still {
			changes = append(changes, &sourcev1.Change{Action: sourcev1.ActionDeleted, Path: p})
		}
	}
	slices.SortFunc(changes, func(a, b *sourcev1.Change) int { return strings.Compare(a.GetPath(), b.GetPath()) })

	start := 0
	if cursor := req.GetCursor(); cursor != "" {
		start, _ = slices.BinarySearchFunc(changes, cursor, func(c *sourcev1.Change, t string) int { return strings.Compare(c.GetPath(), t) })
		if start < len(changes) && changes[start].GetPath() == cursor {
			start++
		}
	}
	end := min(start+s.pageSize(req.GetLimit()), len(changes))
	next := ""
	if end < len(changes) {
		next = changes[end-1].GetPath()
	}
	return &sourcev1.CompareResponse{
		Base: base.revision, Head: head.revision, Complete: next == "", Changes: changes[start:end], NextCursor: next,
	}, nil
}

func (s *Server) checkID(id string) error {
	if id != s.opts.ID {
		return fail(codes.NotFound, sourcev1.CodeSourceNotFound, "unknown source "+id)
	}
	return nil
}

// resolve finds the snapshot for a revision. An empty revision is the current one.
func (s *Server) resolve(revision string) (snapshot, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if revision == "" {
		return s.snapshots[len(s.snapshots)-1], nil
	}
	for _, snap := range s.snapshots {
		if snap.revision == revision {
			return snap, nil
		}
	}
	if _, known := s.seen[revision]; known {
		return snapshot{}, fail(codes.FailedPrecondition, sourcev1.CodeRevisionGone, "revision "+revision+" is no longer retained")
	}
	return snapshot{}, fail(codes.NotFound, sourcev1.CodeRevisionNotFound, "unknown revision "+revision)
}

func (s *Server) current() snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshots[len(s.snapshots)-1]
}

func (s *Server) pageSize(limit int32) int {
	if limit > 0 && int(limit) < s.opts.MaxPageSize {
		return int(limit)
	}
	return s.opts.MaxPageSize
}

func sortedPaths(files map[string]file) []string {
	paths := make([]string, 0, len(files))
	for p := range files {
		paths = append(paths, p)
	}
	slices.Sort(paths)
	return paths
}

// page returns the paths after cursor, at most size of them, and the cursor for the next page.
func page(paths []string, cursor string, size int) ([]string, string) {
	start := 0
	if cursor != "" {
		start, _ = slices.BinarySearch(paths, cursor)
		if start < len(paths) && paths[start] == cursor {
			start++
		}
	}
	end := min(start+size, len(paths))
	if end < len(paths) {
		return paths[start:end], paths[end-1]
	}
	return paths[start:end], ""
}
