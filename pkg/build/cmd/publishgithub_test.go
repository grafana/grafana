package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-github/github"
	"github.com/stretchr/testify/assert"
	"github.com/urfave/cli/v2"
)

type githubPublishTestCases struct {
	name           string
	args           []string
	token          string
	expectedError  error
	errorContains  string
	expectedOutput string
	mockedService  *mockGithubRepositoryServiceImpl
}

var mockGithubRepositoryService = &mockGithubRepositoryServiceImpl{}

func mockGithubRepositoryClient(context.Context, string) githubRepositoryService {
	return mockGithubRepositoryService
}

func TestPublishGithub(t *testing.T) {
	t.Setenv("DRONE_BUILD_EVENT", "promote")
	t.Setenv("DRONE_TAG", "v1.0.0")
	t.Setenv("DRONE_COMMIT", "abcdefgh")
	testApp, testPath := setupPublishGithubTests(t)
	mockErrUnauthorized := errors.New("401")

	testCases := []githubPublishTestCases{
		{
			name:          "try to publish without required flags",
			errorContains: `Required flags "path, repo" not set`,
		},
		{
			name:          "try to publish without token",
			args:          []string{"--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			expectedError: errTokenIsEmpty,
		},
		{
			name:          "try to publish with invalid token",
			token:         "invalid",
			args:          []string{"--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			mockedService: &mockGithubRepositoryServiceImpl{tagErr: mockErrUnauthorized},
			expectedError: mockErrUnauthorized,
		},
		{
			name:          "try to publish with valid token and nonexisting tag with create disabled",
			token:         "valid",
			args:          []string{"--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			mockedService: &mockGithubRepositoryServiceImpl{tagErr: errReleaseNotFound},
			expectedError: errReleaseNotFound,
		},
		{
			name:          "try to publish with valid token and nonexisting tag with create enabled",
			token:         "valid",
			args:          []string{"--path", testPath, "--repo", "test/test", "--tag", "v1.0.0", "--create"},
			mockedService: &mockGithubRepositoryServiceImpl{tagErr: errReleaseNotFound},
		},
		{
			name:  "try to publish with valid token and existing tag",
			token: "valid",
			args:  []string{"--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
		},
		{
			name:           "dry run with invalid token",
			token:          "invalid",
			args:           []string{"--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			mockedService:  &mockGithubRepositoryServiceImpl{tagErr: mockErrUnauthorized},
			expectedOutput: "Github communication error",
		},
		{
			name:           "dry run with valid token and nonexisting tag with create disabled",
			token:          "valid",
			args:           []string{"--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			mockedService:  &mockGithubRepositoryServiceImpl{tagErr: errReleaseNotFound},
			expectedOutput: "Release doesn't exist",
		},
		{
			name:           "dry run with valid token and nonexisting tag with create enabled",
			token:          "valid",
			args:           []string{"--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0", "--create"},
			mockedService:  &mockGithubRepositoryServiceImpl{tagErr: errReleaseNotFound},
			expectedOutput: "Would upload asset",
		},
		{
			name:           "dry run with valid token and existing tag",
			token:          "valid",
			args:           []string{"--dry-run", "--path", testPath, "--repo", "test/test", "--tag", "v1.0.0"},
			expectedOutput: "Would upload asset",
		},
	}

	if os.Getenv("DRONE_COMMIT") == "" {
		// this test only works locally due to Drone environment
		testCases = append(testCases,
			githubPublishTestCases{
				name:          "try to publish without tag",
				args:          []string{"--path", testPath, "--repo", "test/test"},
				expectedError: errTagIsEmpty,
			},
		)
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			if test.token != "" {
				t.Setenv("GH_TOKEN", test.token)
			}
			if test.mockedService != nil {
				mockGithubRepositoryService = test.mockedService
			} else {
				mockGithubRepositoryService = &mockGithubRepositoryServiceImpl{}
			}
			args := []string{"run"}
			args = append(args, test.args...)
			out, err := captureStdout(t, func() error {
				return testApp.Run(args)
			})
			if test.expectedOutput != "" {
				assert.Contains(t, out, test.expectedOutput)
			}
			if test.expectedError != nil || test.errorContains != "" {
				assert.Error(t, err)
				if test.expectedError != nil {
					assert.ErrorIs(t, err, test.expectedError)
				}
				if test.errorContains != "" {
					assert.ErrorContains(t, err, test.errorContains)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func setupPublishGithubTests(t *testing.T) (*cli.App, string) {
	t.Helper()
	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	testPath := filepath.Dir(ex)

	newGithubClient = mockGithubRepositoryClient

	testApp := cli.NewApp()
	testApp.Action = PublishGithub
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
			Usage:    "Github repository",
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
	return testApp, testPath
}

func captureStdout(t *testing.T, fn func() error) (string, error) {
	t.Helper()
	rescueStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	err := fn()
	werr := w.Close()
	if werr != nil {
		return "", err
	}
	out, _ := io.ReadAll(r)
	os.Stdout = rescueStdout
	return string(out), err
}

type mockGithubRepositoryServiceImpl struct {
	tagErr    error
	createErr error
	uploadErr error
}

func (m *mockGithubRepositoryServiceImpl) GetReleaseByTag(ctx context.Context, owner string, repo string, tag string) (*github.RepositoryRelease, *github.Response, error) {
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

func (m *mockGithubRepositoryServiceImpl) CreateRelease(ctx context.Context, owner string, repo string, release *github.RepositoryRelease) (*github.RepositoryRelease, *github.Response, error) {
	releaseID := int64(1)
	return &github.RepositoryRelease{ID: &releaseID}, &github.Response{}, m.createErr
}

func (m *mockGithubRepositoryServiceImpl) UploadReleaseAsset(ctx context.Context, owner string, repo string, id int64, opt *github.UploadOptions, file *os.File) (*github.ReleaseAsset, *github.Response, error) {
	assetName := "test"
	assetUrl := "testurl.com.br"
	return &github.ReleaseAsset{Name: &assetName, BrowserDownloadURL: &assetUrl}, &github.Response{}, m.uploadErr
}
