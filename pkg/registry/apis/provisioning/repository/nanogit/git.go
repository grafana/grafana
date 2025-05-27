package nanogit

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/protocol"
)

// Make sure all public functions of this struct call the (*gitRepository).logger function, to ensure the Git repo details are included.
type gitRepository struct {
	config  *provisioning.Repository
	client  nanogit.Client
	secrets secrets.Service

	url    string
	branch string

	cloneFn repository.CloneFn
}

// GitRepository is an interface that combines all repository capabilities
// needed for Git repositories.
type GitRepository interface {
	repository.Repository
	repository.Versioned
	repository.Writer
	repository.Reader
	repository.ClonableRepository
	URL() string
	Branch() string
}

func NewGitRepository(
	ctx context.Context,
	config *provisioning.Repository,
	secrets secrets.Service,
	cloneFn repository.CloneFn,
) (GitRepository, error) {
	gitURL := config.Spec.Git.URL
	branch := config.Spec.Git.Branch

	token := config.Spec.Git.Token
	if token == "" {
		decrypted, err := secrets.Decrypt(ctx, config.Spec.Git.EncryptedToken)
		if err != nil {
			return nil, fmt.Errorf("decrypt token: %w", err)
		}
		token = string(decrypted)
	}

	logger := logging.FromContext(ctx)
	// Create nanogit client with authentication
	client, err := nanogit.NewHTTPClient(
		gitURL,
		nanogit.WithBasicAuth("git", token),
		nanogit.WithLogger(logger),
	)
	if err != nil {
		return nil, fmt.Errorf("create nanogit client: %w", err)
	}

	return &gitRepository{
		config:  config,
		client:  client,
		secrets: secrets,
		url:     gitURL,
		branch:  branch,
		cloneFn: cloneFn,
	}, nil
}

func (r *gitRepository) Config() *provisioning.Repository {
	return r.config
}

func (r *gitRepository) URL() string {
	return r.url
}

func (r *gitRepository) Branch() string {
	return r.branch
}

// TODO: see if we can provide users with a way to generate those URLs.
// some kind of template or pattern

// Validate implements provisioning.Repository.
func (r *gitRepository) Validate() (list field.ErrorList) {
	git := r.config.Spec.Git
	if git == nil {
		list = append(list, field.Required(field.NewPath("spec", "git"), "a git config is required"))
		return list
	}
	if git.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "git", "url"), "a git url is required"))
	} else {
		if !isValidGitURL(git.URL) {
			list = append(list, field.Invalid(field.NewPath("spec", "git", "url"), git.URL, "invalid git URL format"))
		}
	}
	if git.Branch == "" {
		list = append(list, field.Required(field.NewPath("spec", "git", "branch"), "a git branch is required"))
	} else if !repository.IsValidGitBranchName(git.Branch) {
		list = append(list, field.Invalid(field.NewPath("spec", "git", "branch"), git.Branch, "invalid branch name"))
	}
	if git.Token == "" && len(git.EncryptedToken) == 0 {
		list = append(list, field.Required(field.NewPath("spec", "git", "token"), "a git access token is required"))
	}

	if err := safepath.IsSafe(git.Path); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "git", "path"), git.Path, err.Error()))
	}

	if safepath.IsAbs(git.Path) {
		list = append(list, field.Invalid(field.NewPath("spec", "git", "path"), git.Path, "path must be relative"))
	}

	return list
}

func isValidGitURL(gitURL string) bool {
	// Parse URL
	parsed, err := url.Parse(gitURL)
	if err != nil {
		return false
	}

	// Must be HTTPS
	if parsed.Scheme != "https" {
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
	ctx, _ = r.logger(ctx, "")
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
				Field:  field.NewPath("spec", "git", "token").String(),
				Detail: detail,
			}}}, nil
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
				Field:  field.NewPath("spec", "git", "url").String(),
				Detail: detail,
			}}}, nil
	}

	// Test basic connectivity by getting the branch reference
	_, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", r.branch))
	if err != nil {
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", "git", "branch").String(),
				Detail: err.Error(),
			}}}, nil
	}

	return &provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// Read implements provisioning.Repository.
func (r *gitRepository) Read(ctx context.Context, filePath, ref string) (*repository.FileInfo, error) {
	if ref == "" {
		ref = r.branch
	}

	ctx, _ = r.logger(ctx, ref)
	finalPath := safepath.Join(r.config.Spec.Git.Path, filePath)

	// Get the branch reference
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", ref))
	if err != nil {
		return nil, fmt.Errorf("get branch ref: %w", err)
	}

	// get root hash
	root, err := r.client.GetTree(ctx, branchRef.Hash)
	if err != nil {
		return nil, fmt.Errorf("get root tree: %w", err)
	}

	blob, err := r.client.GetBlobByPath(ctx, root.Hash, finalPath)
	if err != nil {
		if errors.Is(err, nanogit.ErrRefNotFound) {
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
	if ref == "" {
		ref = r.branch
	}

	ctx, _ = r.logger(ctx, ref)

	// Get the branch reference
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", ref))
	if err != nil {
		if errors.Is(err, nanogit.ErrRefNotFound) {
			return nil, repository.ErrRefNotFound
		}
		return nil, fmt.Errorf("get branch ref: %w", err)
	}

	// Get flat tree using nanogit's GetFlatTree
	tree, err := r.client.GetFlatTree(ctx, branchRef.Hash)
	if err != nil {
		if errors.Is(err, nanogit.ErrRefNotFound) {
			return nil, repository.ErrRefNotFound
		}
		return nil, fmt.Errorf("get flat tree: %w", err)
	}

	entries := make([]repository.FileTreeEntry, 0, len(tree.Entries))
	for _, entry := range tree.Entries {
		isBlob := entry.Type == protocol.ObjectTypeBlob
		// Apply path prefix filtering
		relativePath, err := safepath.RelativeTo(entry.Path, r.config.Spec.Git.Path)
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
		ref = r.branch
	}
	ctx, _ = r.logger(ctx, ref)

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}

	finalPath := safepath.Join(r.config.Spec.Git.Path, path)
	// Create .keep file if it is a directory
	if safepath.IsDir(finalPath) {
		if data != nil {
			return apierrors.NewBadRequest("data cannot be provided for a directory")
		}

		finalPath = safepath.Join(finalPath, ".keep")
		data = []byte{}
	}

	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	if _, err = writer.CreateBlob(ctx, finalPath, data); err != nil {
		// TODO: in library, ErrAlreadyExists
		// if errors.Is(err, nanogit.ErrBlobExists) {
		// 	return &apierrors.StatusError{
		// 		ErrStatus: metav1.Status{
		// 			Message: "file already exists",
		// 			Code:    http.StatusConflict,
		// 		},
		// 	}
		// }

		return fmt.Errorf("create blob: %w", err)
	}

	// Commit the changes
	author, committer := r.createSignature(ctx)

	if _, err := writer.Commit(ctx, comment, author, committer); err != nil {
		return fmt.Errorf("commit changes: %w", err)
	}

	// Push the changes
	if err := writer.Push(ctx); err != nil {
		return fmt.Errorf("push changes: %w", err)
	}

	return nil
}

func (r *gitRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.branch
	}
	ctx, _ = r.logger(ctx, ref)

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}

	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	finalPath := safepath.Join(r.config.Spec.Git.Path, path)
	if _, err = writer.UpdateBlob(ctx, finalPath, data); err != nil {
		// TODO: improve nanogit library to have a better error type
		if errors.Is(err, nanogit.ErrRefNotFound) {
			return repository.ErrFileNotFound
		}

		return fmt.Errorf("update blob: %w", err)
	}

	// Commit the changes
	author, committer := r.createSignature(ctx)
	if _, err := writer.Commit(ctx, comment, author, committer); err != nil {
		return fmt.Errorf("commit changes: %w", err)
	}

	// Push the changes
	if err := writer.Push(ctx); err != nil {
		return fmt.Errorf("push changes: %w", err)
	}

	return nil
}

func (r *gitRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	if ref == "" {
		ref = r.branch
	}

	ctx, _ = r.logger(ctx, ref)
	_, err := r.Read(ctx, path, ref)
	if err != nil && !(errors.Is(err, repository.ErrFileNotFound)) {
		return fmt.Errorf("check if file exists before writing: %w", err)
	}
	if err == nil {
		return r.Update(ctx, path, ref, data, message)
	}

	return r.Create(ctx, path, ref, data, message)
}

func (r *gitRepository) Delete(ctx context.Context, path, ref, comment string) error {
	if ref == "" {
		ref = r.branch
	}
	ctx, _ = r.logger(ctx, ref)

	branchRef, err := r.ensureBranchExists(ctx, ref)
	if err != nil {
		return err
	}

	// Create a staged writer
	writer, err := r.client.NewStagedWriter(ctx, branchRef)
	if err != nil {
		return fmt.Errorf("create staged writer: %w", err)
	}

	finalPath := safepath.Join(r.config.Spec.Git.Path, path)

	if _, err = writer.DeleteBlob(ctx, finalPath); err != nil {
		if errors.Is(err, nanogit.ErrRefNotFound) {
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: fmt.Sprintf("file not found: %s", finalPath),
					Code:    http.StatusNotFound,
				},
			}
		}

		return fmt.Errorf("delete blob: %w", err)
	}

	// Commit the changes
	author, committer := r.createSignature(ctx)

	if _, err := writer.Commit(ctx, comment, author, committer); err != nil {
		return fmt.Errorf("commit changes: %w", err)
	}

	// Push the changes
	if err := writer.Push(ctx); err != nil {
		return fmt.Errorf("push changes: %w", err)
	}

	return nil
}

func (r *gitRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.branch
	}
	ctx, _ = r.logger(ctx, ref)

	// Get the branch reference to start the history traversal
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", ref))
	if err != nil {
		if errors.Is(err, nanogit.ErrRefNotFound) {
			return nil, repository.ErrFileNotFound
		}
		return nil, fmt.Errorf("get branch ref: %w", err)
	}

	// Prepare the final path by joining with the configured repository path
	finalPath := safepath.Join(r.config.Spec.Git.Path, path)

	// Set up options for ListCommits with path filtering
	options := nanogit.ListCommitsOptions{
		PerPage: 10, // Reasonable default for history
		Page:    1,
		Path:    finalPath,
	}

	// Get commits using nanogit's ListCommits
	commits, err := r.client.ListCommits(ctx, branchRef.Hash, options)
	if err != nil {
		return nil, fmt.Errorf("list commits: %w", err)
	}

	// Convert nanogit commits to provisioning.HistoryItem format
	ret := make([]provisioning.HistoryItem, 0, len(commits))
	for _, commit := range commits {
		authors := make([]provisioning.Author, 0)

		// Add author if available
		if commit.Author.Name != "" {
			authors = append(authors, provisioning.Author{
				Name: commit.Author.Name,
				// Use email for username as it's the only way to get a unique identifier
				Username: commit.Author.Email,
				// No avatar URL available in Git commits
				AvatarURL: "",
			})
		}

		// Add committer if different from author
		if commit.Committer.Name != "" && commit.Author.Name != commit.Committer.Name {
			authors = append(authors, provisioning.Author{
				Name: commit.Committer.Name,
				// Use email for username as it's the only way to get a unique identifier
				Username: commit.Committer.Email,
				// No avatar URL available in Git commits
				AvatarURL: "",
			})
		}

		ret = append(ret, provisioning.HistoryItem{
			Ref:       commit.Hash.String(),
			Message:   commit.Message,
			Authors:   authors,
			CreatedAt: commit.Time().UnixMilli(),
		})
	}

	return ret, nil
}

func (r *gitRepository) LatestRef(ctx context.Context) (string, error) {
	ctx, _ = r.logger(ctx, "")
	branchRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", r.branch))
	if err != nil {
		return "", fmt.Errorf("get branch ref: %w", err)
	}

	return branchRef.Hash.String(), nil
}

func (r *gitRepository) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	if ref == "" {
		var err error
		ref, err = r.LatestRef(ctx)
		if err != nil {
			return nil, fmt.Errorf("get latest ref: %w", err)
		}
	}
	ctx, logger := r.logger(ctx, ref)

	// Get commit hashes for base and ref
	baseRef, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", base))
	if err != nil {
		return nil, fmt.Errorf("get base ref: %w", err)
	}

	refCommit, err := r.client.GetRef(ctx, fmt.Sprintf("refs/heads/%s", ref))
	if err != nil {
		return nil, fmt.Errorf("get ref commit: %w", err)
	}

	// Compare commits using nanogit
	files, err := r.client.CompareCommits(ctx, baseRef.Hash, refCommit.Hash)
	if err != nil {
		return nil, fmt.Errorf("compare commits: %w", err)
	}

	changes := make([]repository.VersionedFileChange, 0)
	for _, f := range files {
		switch f.Status {
		case protocol.FileStatusAdded:
			currentPath, err := safepath.RelativeTo(f.Path, r.config.Spec.Git.Path)
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
			currentPath, err := safepath.RelativeTo(f.Path, r.config.Spec.Git.Path)
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
			currentPath, err := safepath.RelativeTo(f.Path, r.config.Spec.Git.Path)
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
			currentPath, err := safepath.RelativeTo(f.Path, r.config.Spec.Git.Path)
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

func (r *gitRepository) Clone(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
	return r.cloneFn(ctx, opts)
}

// ensureBranchExists checks if a branch exists and creates it if it doesn't,
// returning the branch reference to avoid duplicate GetRef calls
func (r *gitRepository) ensureBranchExists(ctx context.Context, branchName string) (nanogit.Ref, error) {
	if !repository.IsValidGitBranchName(branchName) {
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
	if !errors.Is(err, nanogit.ErrRefNotFound) {
		return nanogit.Ref{}, fmt.Errorf("check branch exists: %w", err)
	}

	// Branch doesn't exist, create it based on the configured branch
	srcBranch := r.config.Spec.Git.Branch
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
	// TODO: improve nanogit library to have a Signature type
	author := nanogit.Author{
		Name:  "Grafana",
		Email: "noreply@grafana.com",
		Time:  time.Now(),
	}
	committer := nanogit.Committer{
		Name:  "Grafana",
		Email: "noreply@grafana.com",
		Time:  time.Now(),
	}

	// Use signature from context if available
	if sig := repository.GetAuthorSignature(ctx); sig != nil && sig.Name != "" {
		author.Name = sig.Name
		author.Email = sig.Email
		author.Time = sig.When
		committer.Name = sig.Name
		committer.Email = sig.Email
		committer.Time = sig.When
	}

	if author.Time.IsZero() {
		author.Time = time.Now()
		committer.Time = time.Now()
	}

	return author, committer
}

func (r *gitRepository) logger(ctx context.Context, ref string) (context.Context, logging.Logger) {
	logger := logging.FromContext(ctx)

	type containsGit int
	var containsGitKey containsGit
	if ctx.Value(containsGitKey) != nil {
		return ctx, logging.FromContext(ctx)
	}

	if ref == "" {
		ref = r.branch
	}
	logger = logger.With(slog.Group("git_repository", "url", r.url, "ref", ref))
	ctx = logging.Context(ctx, logger)
	// We want to ensure we don't add multiple git_repository keys. With doesn't deduplicate the keys...
	ctx = context.WithValue(ctx, containsGitKey, true)
	return ctx, logger
}
