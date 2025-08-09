package pipeline

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os/exec"
	"sync"

	"dagger.io/dagger"
)

func sha256sum(b []byte) string {
	h := sha256.New()
	h.Write(b)
	return hex.EncodeToString(h.Sum(nil))
}

var mtxMap = &sync.Map{}

// ContainerSHA returns the SHA of a container.
// Note that this doesn't represent the same as a buildkit cache key;
// it does not take into account changes in mounted files / folders.
func ContainerSHA(c *dagger.Container) (string, error) {
	b, err := c.MarshalJSON()
	if err != nil {
		return "", fmt.Errorf("error marshalling container as json: %w", err)
	}

	return sha256sum(b), nil
}

func BuilderImage(registry string, f string, c *dagger.Container) (string, error) {
	sha256, err := ContainerSHA(c)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s/builder:%s-%s", registry, f, sha256), nil
}

type ArtifactHandlerCache struct {
	Handler ArtifactHandler
}

func (a *ArtifactHandlerCache) Dependencies(ctx context.Context) ([]*Artifact, error) {
	return a.Handler.Dependencies(ctx)
}

func (a *ArtifactHandlerCache) Builder(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error) {
	cache := opts.CLIContext.Bool("cache-builders")
	cacheRegistry := opts.CLIContext.String("cache-builders-registry")

	builder, err := a.Handler.Builder(ctx, opts)
	if err != nil {
		return nil, err
	}

	if !cache {
		return builder, err
	}

	n := a.String()
	m, _ := mtxMap.LoadOrStore(n, &sync.Mutex{})
	mtx := m.(*sync.Mutex)

	mtx.Lock()
	defer mtx.Unlock()

	image, err := BuilderImage(cacheRegistry, n, builder)
	if err != nil {
		return nil, err
	}

	out, err := exec.Command("docker", "pull", image).CombinedOutput()
	log.Println("docker", "pull", image, string(out))
	if err == nil {
		return opts.Client.Container().From(image), nil
	}

	if addr, err := builder.Publish(ctx, image); err != nil {
		log.Println("Error publishing container", err, addr)
		return builder, nil
	}

	return builder, nil
}

func (a *ArtifactHandlerCache) BuildFile(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.File, error) {
	return a.Handler.BuildFile(ctx, builder, opts)
}

func (a *ArtifactHandlerCache) BuildDir(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.Directory, error) {
	return a.Handler.BuildDir(ctx, builder, opts)
}

func (a *ArtifactHandlerCache) Publisher(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error) {
	return a.Handler.Publisher(ctx, opts)
}

func (a *ArtifactHandlerCache) PublishFile(ctx context.Context, opts *ArtifactPublishFileOpts) error {
	return a.Handler.PublishFile(ctx, opts)
}

func (a *ArtifactHandlerCache) PublishDir(ctx context.Context, opts *ArtifactPublishDirOpts) error {
	return a.Handler.PublishDir(ctx, opts)
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (a *ArtifactHandlerCache) Filename(ctx context.Context) (string, error) {
	return a.Handler.Filename(ctx)
}

func (a *ArtifactHandlerCache) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return a.Handler.VerifyFile(ctx, client, file)
}

func (a *ArtifactHandlerCache) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	return a.Handler.VerifyDirectory(ctx, client, dir)
}

func (a *ArtifactHandlerCache) String() string {
	return a.Handler.String()
}

func ArtifactWithCache(h ArtifactHandler) ArtifactHandler {
	return &ArtifactHandlerCache{
		Handler: h,
	}
}
