package main

import (
	"context"
	"errors"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-github/github"
	"github.com/stretchr/testify/assert"
	"github.com/urfave/cli/v2"
)

var mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{}

func mockGithubRepositoryClient(context.Context, string) githubRepositoryService {
	return mockGitHubRepositoryService
}

func TestPublishGitHub(t *testing.T) {
	t.Setenv("DRONE_BUILD_EVENT", "promote")

	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	testPath := filepath.Dir(ex)

	newGithubClient = mockGithubRepositoryClient

	testApp := cli.NewApp()
	testApp.Action = PublishGitHub
	testApp.Flags = []cli.Flag{
		&dryRunFlag,
		&cli.StringFlag{
			Name:     "path",
			Required: true,
			Usage:    "Path to the asset to be published",
		},
		&cli.StringFlag{
			Name:     "repo",
			Required: true,
			Usage:    "GitHub repository",
		},
		&cli.StringFlag{
			Name:  "tag",
			Usage: "Release tag (default from metadata)ß",
		},
		&cli.BoolFlag{
			Name:  "create",
			Usage: "Create release if it doesn't exist",
		},
	}

	t.Run("try to publish without required flags", func(t *testing.T) {
		args := []string{"run"}
		err := testApp.Run(args)
		assert.Error(t, err)
		assert.Equal(t, `Required flags "path, repo" not set`, err.Error())
	})

	t.Run("try to publish without tag", func(t *testing.T) {
		args := []string{"run", "--path", testPath, "--repo", "test/test"}
		err := testApp.Run(args)
		assert.ErrorIs(t, err, errTagIsEmpty)
	})

	t.Run("try to publish without token", func(t *testing.T) {
		args := []string{"run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		err := testApp.Run(args)
		assert.ErrorIs(t, err, errTokenIsEmpty)
	})

	t.Run("try to publish with invalid token", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "invalid")
		errUnauthorized := errors.New("401")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errUnauthorized}
		args := []string{"run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		err := testApp.Run(args)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errUnauthorized)
	})

	t.Run("try to publish with valid token and nonexisting tag with create disabled", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errReleaseNotFound}
		args := []string{"run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		err := testApp.Run(args)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errReleaseNotFound)
	})

	t.Run("try to publish with valid token and nonexisting tag with create enabled", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errReleaseNotFound}
		args := []string{"run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0", "--create"}
		err := testApp.Run(args)
		assert.NoError(t, err)
	})

	t.Run("try to publish with valid token and existing tag", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{}
		args := []string{"run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		err := testApp.Run(args)
		assert.NoError(t, err)
	})

	t.Run("dry run with invalid token", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "invalid")
		errUnauthorized := errors.New("401")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errUnauthorized}
		args := []string{"run", "--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		out := testCaptureStdout(func() {
			err := testApp.Run(args)
			assert.NoError(t, err)
		})
		assert.Contains(t, out, "GitHub communication error")
	})

	t.Run("dry run with valid token and nonexisting tag with create disabled", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errReleaseNotFound}
		args := []string{"run", "--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		out := testCaptureStdout(func() {
			err := testApp.Run(args)
			assert.NoError(t, err)
		})
		assert.Contains(t, out, "Release doesn't exist")
	})

	t.Run("dry run with valid token and nonexisting tag with create enabled", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{tagErr: errReleaseNotFound}
		args := []string{"run", "--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0", "--create"}
		out := testCaptureStdout(func() {
			err := testApp.Run(args)
			assert.NoError(t, err)
		})
		assert.Contains(t, out, "Would upload asset")
	})

	t.Run("dry run with valid token and existing tag", func(t *testing.T) {
		t.Setenv("GH_TOKEN", "valid")
		mockGitHubRepositoryService = &mockGitHubRepositoryServiceImpl{}
		args := []string{"run", "--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"}
		out := testCaptureStdout(func() {
			err := testApp.Run(args)
			assert.NoError(t, err)
		})
		assert.Contains(t, out, "Would upload asset")
	})
}

func testCaptureStdout(fn func()) string {
	rescueStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	fn()
	w.Close()
	out, _ := ioutil.ReadAll(r)
	os.Stdout = rescueStdout
	return string(out)
}

type mockGitHubRepositoryServiceImpl struct {
	tagErr    error
	createErr error
	uploadErr error
}

func (m *mockGitHubRepositoryServiceImpl) GetReleaseByTag(ctx context.Context, owner string, repo string, tag string) (*github.RepositoryRelease, *github.Response, error) {
	var release *github.RepositoryRelease
	res := &github.Response{Response: &http.Response{}}
	if m.tagErr == nil {
		releaseID := int64(1)
		release = &github.RepositoryRelease{ID: &releaseID}
	} else if errors.Is(m.tagErr, errReleaseNotFound) {
		res.StatusCode = 404
	}
	return release, res, m.tagErr
}

func (m *mockGitHubRepositoryServiceImpl) CreateRelease(ctx context.Context, owner string, repo string, release *github.RepositoryRelease) (*github.RepositoryRelease, *github.Response, error) {
	releaseID := int64(1)
	return &github.RepositoryRelease{ID: &releaseID}, &github.Response{}, m.createErr
}

func (m *mockGitHubRepositoryServiceImpl) UploadReleaseAsset(ctx context.Context, owner string, repo string, id int64, opt *github.UploadOptions, file *os.File) (*github.ReleaseAsset, *github.Response, error) {
	assetName := "test"
	assetUrl := "testurl.com.br"
	return &github.ReleaseAsset{Name: &assetName, BrowserDownloadURL: &assetUrl}, &github.Response{}, m.uploadErr
}
