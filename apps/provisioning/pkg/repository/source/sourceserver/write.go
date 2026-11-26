package sourceserver

import (
	"context"
	"path"
	"slices"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"

	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

const (
	ifMatchKey = "grpcgateway-if-match"

	maxPathLength   = 1024
	maxPathSegments = 8
)

// PutFile creates or replaces a file, honouring If-None-Match: * and If-Match.
func (s *Server) PutFile(ctx context.Context, req *sourcev1.PutFileRequest) (*sourcev1.Mutation, error) {
	if err := s.checkWritable(req.GetId()); err != nil {
		return nil, err
	}
	if err := validatePath(req.GetPath()); err != nil {
		return nil, err
	}
	data := req.GetBody().GetData()
	if len(data) > maxFileBytes {
		return nil, fail(codes.InvalidArgument, sourcev1.CodeBadRequest, "file exceeds the size limit")
	}

	md, _ := metadata.FromIncomingContext(ctx)
	createOnly := slices.Contains(md.Get(ifNoneMatchKey), "*")
	conditions := md.Get(ifMatchKey)

	var created bool
	revision, err := s.mutate(func(files map[string][]byte) error {
		old, exists := files[req.GetPath()]
		switch {
		case createOnly && exists:
			return fail(codes.AlreadyExists, sourcev1.CodeAlreadyExists, "file already exists: "+req.GetPath())
		case len(conditions) > 0 && !exists:
			if slices.Contains(conditions, "*") {
				return fail(codes.NotFound, sourcev1.CodeFileNotFound, "no such file "+req.GetPath())
			}
			return fail(codes.FailedPrecondition, sourcev1.CodePreconditionFailed, "file no longer exists: "+req.GetPath())
		case len(conditions) > 0 && !slices.Contains(conditions, "*") && !slices.Contains(conditions, `"`+hashOf(old)+`"`):
			return fail(codes.FailedPrecondition, sourcev1.CodePreconditionFailed, "file changed since it was read: "+req.GetPath())
		}
		created = !exists
		files[req.GetPath()] = data
		return nil
	})
	if err != nil {
		return nil, err
	}

	header := metadata.Pairs("etag", `"`+hashOf(data)+`"`)
	if created {
		header.Set(statusKey, "201")
	}
	_ = grpc.SetHeader(ctx, header)
	return &sourcev1.Mutation{Revision: revision}, nil
}

// DeleteFile deletes a file, or every file under a directory when recursive.
func (s *Server) DeleteFile(_ context.Context, req *sourcev1.DeleteFileRequest) (*sourcev1.Mutation, error) {
	if err := s.checkWritable(req.GetId()); err != nil {
		return nil, err
	}

	target := req.GetPath()
	revision, err := s.mutate(func(files map[string][]byte) error {
		if req.GetRecursive() {
			prefix := strings.TrimSuffix(target, "/") + "/"
			var found bool
			for p := range files {
				if strings.HasPrefix(p, prefix) {
					delete(files, p)
					found = true
				}
			}
			if !found {
				return fail(codes.NotFound, sourcev1.CodeFileNotFound, "no such directory "+target)
			}
			return nil
		}

		if _, exists := files[target]; !exists {
			if hasPrefix(files, strings.TrimSuffix(target, "/")+"/") {
				return fail(codes.InvalidArgument, sourcev1.CodeBadRequest, target+" is a directory; delete it recursively")
			}
			return fail(codes.NotFound, sourcev1.CodeFileNotFound, "no such file "+target)
		}
		delete(files, target)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &sourcev1.Mutation{Revision: revision}, nil
}

// Move renames a file, or a directory when both paths end with a slash, in one revision.
func (s *Server) Move(_ context.Context, req *sourcev1.MoveRequest) (*sourcev1.Mutation, error) {
	if err := s.checkWritable(req.GetId()); err != nil {
		return nil, err
	}

	from, to := req.GetFrom(), req.GetTo()
	fromDir, toDir := strings.HasSuffix(from, "/"), strings.HasSuffix(to, "/")
	if from == "" || to == "" || fromDir != toDir {
		return nil, fail(codes.InvalidArgument, sourcev1.CodeBadRequest, "move needs two files or two directories")
	}

	revision, err := s.mutate(func(files map[string][]byte) error {
		moves := map[string]string{}
		if fromDir {
			for p := range files {
				if rel, ok := strings.CutPrefix(p, from); ok {
					moves[p] = to + rel
				}
			}
		} else if _, exists := files[from]; exists {
			moves[from] = to
		}
		if len(moves) == 0 {
			return fail(codes.NotFound, sourcev1.CodeFileNotFound, "nothing to move at "+from)
		}

		for _, dst := range moves {
			if err := validatePath(dst); err != nil {
				return err
			}
			if _, exists := files[dst]; exists {
				if _, moving := moves[dst]; !moving {
					return fail(codes.AlreadyExists, sourcev1.CodeAlreadyExists, "file already exists: "+dst)
				}
			}
		}

		data := make(map[string][]byte, len(moves))
		for src, dst := range moves {
			data[dst] = files[src]
			delete(files, src)
		}
		for dst, b := range data {
			files[dst] = b
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &sourcev1.Mutation{Revision: revision}, nil
}

const maxFileBytes = 5 << 20

func (s *Server) checkWritable(id string) error {
	if err := s.checkID(id); err != nil {
		return err
	}
	if !s.opts.Writable {
		return fail(codes.Unimplemented, sourcev1.CodeNotSupported, "this source cannot be edited")
	}
	return nil
}

// mutate applies an edit to the current tree and publishes the result. Edits are serialized,
// so two concurrent ones never both start from the same revision.
func (s *Server) mutate(edit func(files map[string][]byte) error) (string, error) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	files := s.Files()
	if err := edit(files); err != nil {
		return "", err
	}
	if s.opts.Persist != nil {
		if err := s.opts.Persist(files); err != nil {
			return "", fail(codes.Internal, sourcev1.CodeUnavailable, "could not save the edit: "+err.Error())
		}
	}
	return s.Publish(files), nil
}

func hasPrefix(files map[string][]byte, prefix string) bool {
	for p := range files {
		if strings.HasPrefix(p, prefix) {
			return true
		}
	}
	return false
}

// validatePath enforces the wire format for paths a client wants to write.
func validatePath(p string) error {
	bad := func(msg string) error {
		return fail(codes.InvalidArgument, sourcev1.CodeBadRequest, "invalid path "+p+": "+msg)
	}

	segments := strings.Split(p, "/")
	switch {
	case p == "" || len(p) > maxPathLength:
		return bad("empty or too long")
	case strings.HasPrefix(p, "/") || strings.HasSuffix(p, "/") || strings.Contains(p, `\`):
		return bad("must be a relative file path")
	case len(segments) > maxPathSegments:
		return bad("too many segments")
	}
	for _, seg := range segments {
		if seg == "" || seg == "." || seg == ".." {
			return bad("empty or relative segment")
		}
	}
	if base := path.Base(p); base != ".keep" {
		if ext := path.Ext(base); ext != ".yaml" && ext != ".yml" && ext != ".json" {
			return bad("extension must be .yaml, .yml or .json")
		}
	}
	return nil
}
