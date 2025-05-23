package pipeline

import (
	"context"
	"errors"
	"log/slog"

	"dagger.io/dagger"
)

var (
	ErrorNotADirectory      = errors.New("not a directory argument")
	ErrorOptionNotSet       = errors.New("expected option not set")
	ErrorDependencyNotFound = errors.New("dependency not found")
)

type ArtifactType int

const (
	ArtifactTypeFile ArtifactType = iota
	ArtifactTypeDirectory
)

type ArtifactContainerOpts struct {
	Log      *slog.Logger
	Client   *dagger.Client
	Platform dagger.Platform
	State    StateHandler
	Store    ArtifactStore
}

type ArtifactPublishFileOpts struct{}
type ArtifactPublishDirOpts struct{}

type ArtifactInitializer func(context.Context, *slog.Logger, string, StateHandler) (*Artifact, error)

// An Artifact is a file or a directory that is created when using the `-a / --artifact` flag.
// Each artifact can depend on other artifacts, and can be affected by 'flags' from the artifact string that describes this artifact.
// For example, the flags in the artifact string, 'targz:linux/amd64:grafana'
type ArtifactHandler interface {
	Dependencies(ctx context.Context) ([]*Artifact, error)
	Builder(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error)
	BuildFile(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.File, error)
	BuildDir(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.Directory, error)

	Publisher(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error)
	PublishFile(ctx context.Context, opts *ArtifactPublishFileOpts) error
	PublishDir(ctx context.Context, opts *ArtifactPublishDirOpts) error

	// Filename should return a deterministic file or folder name that this build will produce.
	// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
	// also affect the filename to ensure that there are no collisions.
	// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
	// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
	Filename(ctx context.Context) (string, error)

	VerifyFile(context.Context, *dagger.Client, *dagger.File) error
	VerifyDirectory(context.Context, *dagger.Client, *dagger.Directory) error
}

type Artifact struct {
	// ArtifactString is the artifact string provided by the user.
	// If the artifact is being initialized as a dependency where an artifact string is not provided,
	// then the artifactstring should be set with the parent's artifact string.
	// For example, the targz artifact depends on the binary artifact. If a user requests a targz using the artifactstring
	// 'targz:linux/amd64:grafana', then its dependencies should also have that ArtifactString.
	// This value is really only used for logging.
	ArtifactString string
	Handler        ArtifactHandler
	// Type is the type of the artifact which is used when deciding whether to use BuildFile or BuildDir when building the artifact
	Type ArtifactType
	// Flags are the available list of flags that can individually contribute to the outcome of the artifact. Unlike arguments, flags are
	// specific to the argument.
	// For example, users can request the same argument with different flags:
	// * targz:linux/amd64:grafana
	// * targz:linux/amd64:grafana-enterprise
	// The flags returned by this function should simply define what flags are allowed for this argument.
	// A single flag can manipulate multiple options. For example, the 'boring' option modifies both the GOEXPERIMENT environment variable and ensures that the
	// package is built with grafana enterprise.
	// The options that the flag affects is in the flag itself. The options that the flag manipulates should be available to the callers by using the "Option" function.
	// These flags are only set here so that the CLI can communicate what flags are possible.
	Flags []Flag
}

// Apply applies the flag into the OptionsHandler.
// This is a good opportunity for an artifact to handle being given a Flag in a different way than just storing its options.
func (a *Artifact) Apply(f Flag, o OptionsHandler) error {
	return o.Apply(f)
}
