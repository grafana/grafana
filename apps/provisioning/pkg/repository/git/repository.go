package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/options"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/retry"
)

type RepositoryConfig struct {
	URL       string
	Branch    string
	TokenUser string
	Token     common.RawSecureValue
	Path      string
}

// Make sure all public functions of this struct call the (*gitRepository).logger function, to ensure the Git repo details are included.
type gitRepository struct {
	config    *provisioning.Repository
	gitConfig RepositoryConfig
	client    nanogit.Client
}

func NewRepository(
	_ context.Context,
	config *provisioning.Repository,
	gitConfig RepositoryConfig,
) (GitRepository, error) {
	var opts []options.Option
	if !gitConfig.Token.IsZero() {
		tokenUser := gitConfig.TokenUser
		if tokenUser == "" {
			tokenUser = "git"
		}

		opts = append(opts, options.WithBasicAuth(tokenUser, string(gitConfig.Token)))
	}

	client, err := nanogit.NewHTTPClient(gitConfig.URL, opts...)
	if err != nil {
		return nil, fmt.Errorf("create nanogit client: %w", err)
	}

	return &gitRepository{
		config:    config,
		gitConfig: gitConfig,
		client:    client,
	}, nil
}

func (r *gitRepository) URL() string {
	return r.gitConfig.URL
}

func (r *gitRepository) Branch() string {
	return r.gitConfig.Branch
}

func (r *gitRepository) SetBranch(branch string) {
	r.gitConfig.Branch = branch
}

func (r *gitRepository) GetCurrentBranch() string {
	return r.gitConfig.Branch
}

func (r *gitRepository) GetDefaultBranch(ctx context.Context) (string, error) {
	ctx, _ = r.withGitContext(ctx, "")

	// Get all refs to find the default branch
	refs, err := r.client.ListRefs(ctx)
	if err != nil {
		return "", fmt.Errorf("list refs: %w", err)
	}

	var hasMain, hasMaster bool
	var firstBranch string

	// Single pass through refs to find main, master, or first branch alphabetically
	for _, ref := range refs {
		if !strings.HasPrefix(ref.Name, "refs/heads/") {
			continue
		}

		branchName := strings.TrimPrefix(ref.Name, "refs/heads/")

		// Check for main or master
		switch branchName {
		case "main":
			hasMain = true
		case "master":
			hasMaster = true
		}

		// Track first branch alphabetically as fallback
		if firstBranch == "" || branchName < firstBranch {
			firstBranch = branchName
		}
	}

	// No branches found
	if firstBranch == "" {
		return "", fmt.Errorf("no branches found in repository")
	}

	// Prefer main, then master, then first branch alphabetically
	if hasMain {
		return "main", nil
	}
	if hasMaster {
		return "master", nil
	}

	// If neither main nor master exists, return the first branch alphabetically.
	// This provides deterministic behavior when working with repositories that use
	// non-standard default branch names (e.g., "develop", "trunk", custom names).
	// Users can always change the branch afterward or specify it directly in the repository configuration.
	return firstBranch, nil
}

func (r *gitRepository) Config() *provisioning.Repository {
	return r.config
}

func isValidGitURL(gitURL string) bool {
	// Parse URL
	parsed, err := url.Parse(gitURL)
	if err != nil {
		return false
	}

	// Must be HTTPS or HTTP (HTTP allowed for local development)
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return false
	}

	// Must have a host
	if parsed.Host == "" {
		return false
	}

	// Must have a path
	if parsed.Path == "" || parsed.Path == "/" {
		return false
	}

	return true
}

// Test implements provisioning.Repository.
func (r *gitRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	ctx, _ = r.withGitContext(ctx, "")

	t := string(r.config.Spec.Type)

	// In case the branch is empty
	if r.GetCurrentBranch() == "" {
		branch, err := r.GetDefaultBranch(ctx)
		if err != nil {
			return nil, err
		}

		r.SetBranch(branch)
	}

	if ok, err := r.client.IsAuthorized(ctx); err != nil || !ok {
		detail := "not authorized"
		if err != nil {
			detail = fmt.Sprintf("failed check if authorized: %v", err)
		}

		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("secure", "token").String(),
				Detail: detail,
			}},
		}, nil
	}

	if ok, err := r.client.RepoExists(ctx); err != nil || !ok {
		detail := "repository not found"
		if err != nil {
			detail = fmt.Sprintf("failed check if repository exists: %v", err)
		}

		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", t, "url").String(),
				Detail: detail,
			}},
		}, nil
	}

	// Test basic connectivity by getting the branch reference
	_, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", r.gitConfig.Branch))
	if err != nil {
		detail := "branch not found"
		if errors.Is(err, nanogit.ErrObjectNotFound) {
			return &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("spec", t, "branch").String(),
					Detail: detail,
				}},
			}, nil
		}

		detail = fmt.Sprintf("failed to check if branch exists: %v", err)

		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", t, "branch").String(),
				Detail: detail,
			}},
		}, nil
	}

	return &provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// Read implements provisioning.Repository.
func (r *gitRepository) Read(ctx context.Context, filePath, ref string) (*repository.FileInfo, error) {
	ctx, _ = r.withGitContext(ctx, ref)
	finalPath := safepath.Join(r.gitConfig.Path, filePath)

	// Resolve ref to commit hash
	refHash, err := r.resolveRefToHash(ctx, ref)
	if err != nil {
		return nil, err
	}

	// get root hash
	// TODO: Fix GetTree in nanogit as it does not work commit hash
	commit, err := r.client.GetCommit(ctx, refHash)
	if err != nil {
		return nil, fmt.Errorf("get commit: %w", err)
	}

	// Check if the path represents a directory
	if safepath.IsDir(filePath) {
		// Strip trailing slash for git tree lookup to avoid empty path components
		finalPath = strings.TrimSuffix(finalPath, "/")
		tree, err := r.client.GetTreeByPath(ctx, commit.Tree, finalPath)
		if err != nil {
			if errors.Is(err, nanogit.ErrObjectNotFound) {
				return nil, repository.ErrFileNotFound
			}

			return nil, fmt.Errorf("get tree by path: %w", err)
		}

		return &repository.FileInfo{
			Path: filePath,
			Ref:  refHash.String(),
			Hash: tree.Hash.String(),
		}, nil
	}

	blob, err := r.client.GetBlobByPath(ctx, commit.Tree, finalPath)
	if err != nil {
		if errors.Is(err, nanogit.ErrObjectNotFound) {
			return nil, repository.ErrFileNotFound
		}

		return nil, fmt.Errorf("read blob: %w", err)
	}

	return &repository.FileInfo{
		Path: filePath,
		Ref:  ref,
		Data: blob.Content,
		Hash: blob.Hash.String(),
	}, nil
}

func (r *gitRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	ctx, _ = r.withGitContext(ctx, ref)

	// Resolve ref to commit hash
	refHash, err := r.resolveRefToHash(ctx, ref)
	if err != nil {
		return nil, err
	}

	// Get flat tree using nanogit's GetFlatTree
	tree, err := r.client.GetFlatTree(ctx, refHash)
	if err != nil {
		if errors.Is(err, nanogit.ErrObjectNotFound) {
			return nil, repository.ErrRefNotFound
		}
		return nil, fmt.Errorf("get flat tree: %w", err)
	}

	entries := make([]repository.FileTreeEntry, 0, len(tree.Entries))
	for _, entry := range tree.Entries {
		isBlob := entry.Type == protocol.ObjectTypeBlob
		// Apply path prefix filtering
		relativePath, err := safepath.RelativeTo(entry.Path, r.gitConfig.Path)
		if err != nil {
			// File is outside configured path, skip it
			continue
		}

		filePath := relativePath
		if !isBlob && !safepath.IsDir(filePath) {
			filePath = filePath + "/"
		}

		converted := repository.FileTreeEntry{
			Path: filePath,
			// TODO: Remove size from repository.FileTreeEntry. We don't need it per se.
			Size: 0, // FlatTreeEntry doesn't have size, set to 0
			Hash: entry.Hash.String(),
			Blob: isBlob,
		}
		entries = append(entries, converted)
	}
	return entries, nil
}

func (r *gitRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.gitConfig.Branch
	}
	ctx, _ = r.withGitContext(ctx, ref)
	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}

	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	if err := r.create(ctx, path, data, writer); err != nil {
		return err
	}

	return r.commitAndPush(ctx, writer, comment)
}

func (r *gitRepository) create(ctx context.Context, path string, data []byte, writer nanogit.StagedWriter) error {
	finalPath := safepath.Join(r.gitConfig.Path, path)
	// Create .keep file if it is a directory
	if safepath.IsDir(finalPath) {
		if data != nil {
			return apierrors.NewBadRequest("data cannot be provided for a directory")
		}

		finalPath = safepath.Join(finalPath, ".keep")
		data = []byte{}
	}

	if _, err := writer.CreateBlob(ctx, finalPath, data); err != nil {
		if errors.Is(err, nanogit.ErrObjectAlreadyExists) {
			return repository.ErrFileAlreadyExists
		}

		return fmt.Errorf("create blob: %w", err)
	}

	return nil
}

func (r *gitRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.gitConfig.Branch
	}
	ctx, _ = r.withGitContext(ctx, ref)

	// Check if trying to update a directory
	if safepath.IsDir(path) {
		return apierrors.NewBadRequest("cannot update a directory")
	}

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}
	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	if err := r.update(ctx, path, data, writer); err != nil {
		return err
	}

	return r.commitAndPush(ctx, writer, comment)
}

func (r *gitRepository) update(ctx context.Context, path string, data []byte, writer nanogit.StagedWriter) error {
	// Check if trying to update a directory
	if safepath.IsDir(path) {
		return apierrors.NewBadRequest("cannot update a directory")
	}

	finalPath := safepath.Join(r.gitConfig.Path, path)
	if _, err := writer.UpdateBlob(ctx, finalPath, data); err != nil {
		if errors.Is(err, nanogit.ErrObjectNotFound) {
			return repository.ErrFileNotFound
		}

		return fmt.Errorf("update blob: %w", err)
	}

	return nil
}

func (r *gitRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	if ref == "" {
		ref = r.gitConfig.Branch
	}

	ctx, _ = r.withGitContext(ctx, ref)
	info, err := r.Read(ctx, path, ref)
	if err != nil && !(errors.Is(err, repository.ErrFileNotFound)) {
		return fmt.Errorf("check if file exists before writing: %w", err)
	}
	if err == nil {
		// If the value already exists and is the same, we don't need to do anything
		if bytes.Equal(info.Data, data) {
			return nil
		}
		return r.Update(ctx, path, ref, data, message)
	}

	return r.Create(ctx, path, ref, data, message)
}

func (r *gitRepository) Delete(ctx context.Context, path, ref, comment string) error {
	if ref == "" {
		ref = r.gitConfig.Branch
	}
	ctx, _ = r.withGitContext(ctx, ref)

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}
	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	if err := r.delete(ctx, path, writer); err != nil {
		return err
	}

	return r.commitAndPush(ctx, writer, comment)
}

func (r *gitRepository) Move(ctx context.Context, oldPath, newPath, ref, comment string) error {
	if ref == "" {
		ref = r.gitConfig.Branch
	}
	ctx, _ = r.withGitContext(ctx, ref)

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}

	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	if err := r.move(ctx, oldPath, newPath, writer); err != nil {
		return err
	}

	return r.commitAndPush(ctx, writer, comment)
}

func (r *gitRepository) delete(ctx context.Context, path string, writer nanogit.StagedWriter) error {
	finalPath := safepath.Join(r.gitConfig.Path, path)
	// Check if it's a directory - use DeleteTree for directories, DeleteBlob for files
	if safepath.IsDir(path) {
		trimmed := strings.TrimSuffix(finalPath, "/")
		if _, err := writer.DeleteTree(ctx, trimmed); err != nil {
			if errors.Is(err, nanogit.ErrObjectNotFound) {
				return repository.ErrFileNotFound
			}
			return fmt.Errorf("delete tree: %w", err)
		}
	} else {
		if _, err := writer.DeleteBlob(ctx, finalPath); err != nil {
			if errors.Is(err, nanogit.ErrObjectNotFound) {
				return repository.ErrFileNotFound
			}
			return fmt.Errorf("delete blob: %w", err)
		}
	}

	return nil
}

func (r *gitRepository) move(ctx context.Context, oldPath, newPath string, writer nanogit.StagedWriter) error {
	oldFinalPath := safepath.Join(r.gitConfig.Path, oldPath)
	newFinalPath := safepath.Join(r.gitConfig.Path, newPath)

	// Check if moving directories
	if safepath.IsDir(oldPath) && safepath.IsDir(newPath) {
		// For directories, trim trailing slashes and use MoveTree
		oldTrimmed := strings.TrimSuffix(oldFinalPath, "/")
		newTrimmed := strings.TrimSuffix(newFinalPath, "/")

		if _, err := writer.MoveTree(ctx, oldTrimmed, newTrimmed); err != nil {
			if errors.Is(err, nanogit.ErrObjectNotFound) {
				return repository.ErrFileNotFound
			}
			if errors.Is(err, nanogit.ErrObjectAlreadyExists) {
				return repository.ErrFileAlreadyExists
			}
			return fmt.Errorf("move tree: %w", err)
		}
	} else if !safepath.IsDir(oldPath) && !safepath.IsDir(newPath) {
		// For files, use MoveBlob operation
		if _, err := writer.MoveBlob(ctx, oldFinalPath, newFinalPath); err != nil {
			if errors.Is(err, nanogit.ErrObjectNotFound) {
				return repository.ErrFileNotFound
			}
			if errors.Is(err, nanogit.ErrObjectAlreadyExists) {
				return repository.ErrFileAlreadyExists
			}
			return fmt.Errorf("move blob: %w", err)
		}
	} else {
		// Mismatched types (file to directory or vice versa)
		return apierrors.NewBadRequest("cannot move between file and directory types")
	}

	return nil
}

func (r *gitRepository) History(_ context.Context, _ string, _ string) ([]provisioning.HistoryItem, error) {
	return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusNotImplemented,
		Reason:  metav1.StatusReasonMethodNotAllowed,
		Message: "history is not supported for pure git repositories",
	}}
}

func (r *gitRepository) ListRefs(ctx context.Context) ([]provisioning.RefItem, error) {
	ctx, _ = r.withGitContext(ctx, "")
	refs, err := r.client.ListRefs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list refs: %w", err)
	}
	refItems := make([]provisioning.RefItem, 0, len(refs))
	for _, ref := range refs {
		// Only branches
		if !strings.HasPrefix(ref.Name, "refs/heads/") {
			continue
		}

		refItems = append(refItems, provisioning.RefItem{
			Name: strings.TrimPrefix(ref.Name, "refs/heads/"),
			Hash: ref.Hash.String(),
		})
	}

	return refItems, nil
}

func (r *gitRepository) LatestRef(ctx context.Context) (string, error) {
	ctx, _ = r.withGitContext(ctx, "")
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", r.gitConfig.Branch))
	if err != nil {
		return "", fmt.Errorf("get branch ref: %w", err)
	}

	return branchRef.Hash.String(), nil
}

func (r *gitRepository) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	if base == "" && ref == "" {
		return nil, fmt.Errorf("base and ref cannot be empty")
	}
	if ref == "" {
		return nil, fmt.Errorf("ref cannot be empty")
	}

	ctx, logger := r.withGitContext(ctx, ref)

	// Resolve base ref to hash
	var baseHash hash.Hash
	if base != "" {
		var err error
		baseHash, err = r.resolveRefToHash(ctx, base)
		if err != nil {
			return nil, fmt.Errorf("resolve base ref: %w", err)
		}
	}

	// Resolve ref to hash
	refHash, err := r.resolveRefToHash(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("resolve ref: %w", err)
	}

	// Get commit hashes for base and ref
	// Compare commits using nanogit
	files, err := r.client.CompareCommits(ctx, baseHash, refHash)
	if err != nil {
		return nil, fmt.Errorf("compare commits: %w", err)
	}

	changes := make([]repository.VersionedFileChange, 0)
	for _, f := range files {
		switch f.Status {
		case protocol.FileStatusAdded:
			currentPath, err := safepath.RelativeTo(f.Path, r.gitConfig.Path)
			if err != nil {
				// do nothing as it's outside of configured path
				continue
			}

			changes = append(changes, repository.VersionedFileChange{
				Path:   currentPath,
				Ref:    ref,
				Action: repository.FileActionCreated,
			})
		case protocol.FileStatusModified:
			currentPath, err := safepath.RelativeTo(f.Path, r.gitConfig.Path)
			if err != nil {
				// do nothing as it's outside of configured path
				continue
			}

			changes = append(changes, repository.VersionedFileChange{
				Path:   currentPath,
				Ref:    ref,
				Action: repository.FileActionUpdated,
			})
		case protocol.FileStatusDeleted:
			currentPath, err := safepath.RelativeTo(f.Path, r.gitConfig.Path)
			if err != nil {
				// do nothing as it's outside of configured path
				continue
			}

			changes = append(changes, repository.VersionedFileChange{
				Ref:          ref,
				PreviousRef:  base,
				Path:         currentPath,
				PreviousPath: currentPath,
				Action:       repository.FileActionDeleted,
			})
		case protocol.FileStatusTypeChanged:
			// Handle type changes as modifications
			currentPath, err := safepath.RelativeTo(f.Path, r.gitConfig.Path)
			if err != nil {
				// do nothing as it's outside of configured path
				continue
			}

			changes = append(changes, repository.VersionedFileChange{
				Path:   currentPath,
				Ref:    ref,
				Action: repository.FileActionUpdated,
			})
		default:
			logger.Error("ignore unhandled file", "file", f.Path, "status", string(f.Status))
		}
	}

	return changes, nil
}

func (r *gitRepository) Stage(ctx context.Context, opts repository.StageOptions) (repository.StagedRepository, error) {
	ctx = ensureRetryContext(ctx)
	ctx, _ = r.withGitContext(ctx, "")
	return NewStagedGitRepository(ctx, r, opts)
}

// resolveRefToHash resolves a ref (branch name or commit hash) to a commit hash
func (r *gitRepository) resolveRefToHash(ctx context.Context, ref string) (hash.Hash, error) {
	ctx, _ = r.withGitContext(ctx, ref)

	// Use default branch if ref is empty
	if ref == "" {
		ref = r.gitConfig.Branch
	}

	// Try to parse ref as a hash first
	refHash, err := hash.FromHex(ref)
	if err == nil && refHash != hash.Zero {
		// Valid hash, return it
		return refHash, nil
	}

	// Prefix ref with refs/heads/
	ref = fmt.Sprintf("refs/heads/%s", ref)

	// Not a valid hash, try to resolve as a branch reference
	branchRef, err := r.client.GetRef(ctx, ref)
	if err != nil {
		if errors.Is(err, nanogit.ErrObjectNotFound) {
			return hash.Zero, fmt.Errorf("ref not found: %s: %w", ref, repository.ErrRefNotFound)
		}
		return hash.Zero, fmt.Errorf("get ref %s: %w", ref, err)
	}

	return branchRef.Hash, nil
}

// ensureBranchExists checks if a branch exists and creates it if it doesn't,
// returning the branch reference to avoid duplicate GetRef calls
func (r *gitRepository) ensureBranchExists(ctx context.Context, branchName string) (nanogit.Ref, error) {
	ctx, _ = r.withGitContext(ctx, branchName)

	if !IsValidGitBranchName(branchName) {
		return nanogit.Ref{}, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Code:    http.StatusBadRequest,
				Message: "invalid branch name",
			},
		}
	}

	// Check if branch exists by trying to get the branch reference
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", branchName))
	if err == nil {
		// Branch exists, return it
		logging.FromContext(ctx).Info("branch already exists", "branch", branchName)
		return branchRef, nil
	}

	// If error is not "ref not found", return the error
	if !errors.Is(err, nanogit.ErrObjectNotFound) {
		return nanogit.Ref{}, fmt.Errorf("check branch exists: %w", err)
	}

	// Branch doesn't exist, create it based on the configured branch
	srcBranch := r.gitConfig.Branch
	srcRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", srcBranch))
	if err != nil {
		return nanogit.Ref{}, fmt.Errorf("get source branch ref: %w", err)
	}

	// Create the new branch reference
	newRef := nanogit.Ref{
		Name: fmt.Sprintf("refs/heads/%s", branchName),
		Hash: srcRef.Hash,
	}

	if err := r.client.CreateRef(ctx, newRef); err != nil {
		return nanogit.Ref{}, fmt.Errorf("create branch: %w", err)
	}

	return newRef, nil
}

// createSignature creates author and committer signatures using the context signature if available,
// falling back to default Grafana signature
func (r *gitRepository) createSignature(ctx context.Context) (nanogit.Author, nanogit.Committer) {
	author := nanogit.Author{
		Name:  "Grafana",
		Email: "noreply@grafana.com",
		Time:  time.Now(),
	}

	// Use signature from context if available
	if sig := repository.GetAuthorSignature(ctx); sig != nil {
		if sig.Name != "" {
			author.Name = sig.Name
		}
		if sig.Email != "" {
			author.Email = sig.Email
		}
		if !sig.When.IsZero() {
			author.Time = sig.When
		}
	}

	if author.Time.IsZero() {
		author.Time = time.Now()
	}

	// Author and committer are always the same (for now)
	return author, nanogit.Committer(author)
}

func (r *gitRepository) commit(ctx context.Context, writer nanogit.StagedWriter, comment string) error {
	author, committer := r.createSignature(ctx)
	if _, err := writer.Commit(ctx, comment, author, committer); err != nil {
		if errors.Is(err, nanogit.ErrNothingToCommit) {
			return repository.ErrNothingToCommit
		}

		return fmt.Errorf("commit changes: %w", err)
	}
	return nil
}

func (r *gitRepository) commitAndPush(ctx context.Context, writer nanogit.StagedWriter, comment string) error {
	if err := r.commit(ctx, writer, comment); err != nil {
		return err
	}

	if err := writer.Push(ctx); err != nil {
		return fmt.Errorf("push changes: %w", err)
	}

	return nil
}

// defaultGitRetrier returns a default retrier configuration for Git operations.
//
// Retry attempts will happen when:
//   - Network errors occur: connection timeouts, temporary network failures, or connection errors
//   - HTTP 5xx server errors: For GET and DELETE operations (idempotent)
//   - HTTP 429 Too Many Requests: For all operations (rate limiting is temporary)
//
// The retry behavior:
//   - Total attempts: 8 (1 initial attempt + 7 retries)
//   - Initial delay: 100ms before the first retry
//   - Exponential backoff: delay doubles after each failed attempt (100ms → 200ms → 400ms → 800ms → 1.6s → 3.2s → 5s)
//   - Maximum delay: capped at 5 seconds
//   - Jitter: enabled to prevent thundering herd problems
//   - Total retry window: approximately 10 seconds from first attempt to last retry
//
// All attempts will fail when:
//   - The Git server is completely unavailable or unreachable
//   - Network connectivity issues persist beyond the retry window (~10 seconds)
//   - The server returns transient errors consistently for the entire retry duration
//   - Context cancellation occurs before retries complete
//
// Non-transient errors (e.g., 4xx client errors except 429, authentication failures) are not retried and returned immediately.
func defaultGitRetrier() *retry.ExponentialBackoffRetrier {
	return retry.NewExponentialBackoffRetrier().
		WithMaxAttempts(8). // 1 initial + 7 retries = 8 total attempts (~10s total retry window)
		WithInitialDelay(100 * time.Millisecond).
		WithMaxDelay(5 * time.Second).
		WithMultiplier(2.0).
		WithJitter()
}

// ensureRetryContext ensures that retry logic is configured in the context.
// This function should be called at the beginning of all methods that make client calls
// to guarantee retry logic is always present, regardless of context state.
func ensureRetryContext(ctx context.Context) context.Context {
	// Only add retrier if one doesn't already exist in the context
	if retry.FromContext(ctx).MaxAttempts() <= 1 {
		ctx = retry.ToContext(ctx, defaultGitRetrier())
	}
	return ctx
}

// withGitContext sets up the context with logging, git repository metadata, and retry logic.
// This function should be called at the beginning of all public methods to ensure:
// - Proper logging context with git repository details
// - Retry logic is configured for all Git operations
// - Context is properly prepared for nanogit client calls
func (r *gitRepository) withGitContext(ctx context.Context, ref string) (context.Context, logging.Logger) {
	// Ensure retry logic is configured first, before any early returns
	ctx = ensureRetryContext(ctx)

	logger := logging.FromContext(ctx)

	type containsGit int
	var containsGitKey containsGit
	if ctx.Value(containsGitKey) != nil {
		return ctx, logging.FromContext(ctx)
	}

	if ref == "" {
		ref = r.gitConfig.Branch
	}
	logger = logger.With(slog.Group("git_repository", "url", r.gitConfig.URL, "ref", ref, "nanogit", true))
	ctx = logging.Context(ctx, logger)
	// We want to ensure we don't add multiple git_repository keys. With doesn't deduplicate the keys...
	ctx = context.WithValue(ctx, containsGitKey, true)

	ctx = log.ToContext(ctx, logger)

	return ctx, logger
}
