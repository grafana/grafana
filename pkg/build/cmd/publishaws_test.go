package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/ecr"
	"github.com/aws/aws-sdk-go/service/marketplacecatalog"
	"github.com/docker/docker/api/types/image"
	"github.com/grafana/grafana/pkg/build/cmd/util"
	"github.com/stretchr/testify/assert"
	"github.com/urfave/cli/v2"
)

type awsPublishTestCase struct {
	name           string
	args           []string
	expectedError  error
	errorContains  string
	expectedOutput string
	mockedService  *AwsMarketplacePublishingService
}

func TestPublishAwsMarketplace(t *testing.T) {
	t.Setenv("DRONE_BUILD_EVENT", "promote")
	t.Setenv("DRONE_TAG", "v1.0.0")
	t.Setenv("DRONE_COMMIT", "abcdefgh")
	testApp := setupPublishAwsMarketplaceTests(t)
	errShouldNotCallMock := errors.New("shouldn't call")

	testCases := []awsPublishTestCase{
		{
			name:          "try to publish without required flags",
			errorContains: `Required flags "image, repo, product" not set`,
		},
		{
			name: "try to publish without credentials",
			args: []string{"--image", "test/test", "--repo", "test/test", "--product", "test", "--version", "1.0.0"},
			mockedService: &AwsMarketplacePublishingService{
				ecr: &mockAwsMarketplaceRegistry{
					GetAuthorizationTokenWithContextError: credentials.ErrNoValidProvidersFoundInChain,
				},
			},
			expectedError: credentials.ErrNoValidProvidersFoundInChain,
		},
		{
			name: "try to publish with valid credentials and nonexisting version",
			args: []string{"--image", "test/test", "--repo", "test/test", "--product", "test", "--version", "1.0.0"},
			mockedService: &AwsMarketplacePublishingService{
				ecr:    &mockAwsMarketplaceRegistry{},
				docker: &mockAwsMarketplaceDocker{},
				mkt:    &mockAwsMarketplaceCatalog{},
			},
			expectedOutput: "Releasing to product",
		},
		{
			name: "try to publish with valid credentials and existing version",
			args: []string{"--image", "test/test", "--repo", "test/test", "--product", "test", "--version", "1.0.0"},
			mockedService: &AwsMarketplacePublishingService{
				ecr:    &mockAwsMarketplaceRegistry{},
				docker: &mockAwsMarketplaceDocker{},
				mkt:    &mockAwsMarketplaceCatalog{},
			},
			expectedOutput: "Releasing to product",
		},
		{
			name: "dry run with invalid credentials",
			args: []string{"--dry-run", "--image", "test/test", "--repo", "test/test", "--product", "test", "--version", "1.0.0"},
			mockedService: &AwsMarketplacePublishingService{
				ecr: &mockAwsMarketplaceRegistry{
					GetAuthorizationTokenWithContextError: credentials.ErrNoValidProvidersFoundInChain,
				},
			},
			expectedError: credentials.ErrNoValidProvidersFoundInChain,
		},
		{
			name: "dry run with valid credentials",
			args: []string{"--dry-run", "--image", "test/test", "--repo", "test/test", "--product", "test", "--version", "1.0.0"},
			mockedService: &AwsMarketplacePublishingService{
				ecr: &mockAwsMarketplaceRegistry{},
				docker: &mockAwsMarketplaceDocker{
					ImagePushError: errShouldNotCallMock,
				},
				mkt: &mockAwsMarketplaceCatalog{
					StartChangeSetWithContextError: errShouldNotCallMock,
				},
			},
			expectedOutput: "Dry-Run: Releasing to product",
		},
	}

	if os.Getenv("DRONE_COMMIT") == "" {
		// this test only works locally due to Drone environment
		testCases = append(testCases,
			awsPublishTestCase{
				name:          "try to publish without version",
				args:          []string{"--image", "test/test", "--repo", "test/test", "--product", "test"},
				expectedError: errEmptyVersion,
			},
		)
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.WithValue(context.Background(), publishAwsMarketplaceTestKey, test.mockedService)
			args := []string{"run"}
			args = append(args, test.args...)
			out, err := captureStdout(t, func() error {
				return testApp.RunContext(ctx, args)
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

func setupPublishAwsMarketplaceTests(t *testing.T) *cli.App {
	t.Helper()
	testApp := cli.NewApp()
	testApp.Action = PublishAwsMarketplace
	testApp.Flags = []cli.Flag{
		&util.DryRunFlag,
		&cli.StringFlag{
			Name:  "version",
			Usage: "Release version (default from metadata)",
		},
		&cli.StringFlag{
			Name:     "image",
			Required: true,
			Usage:    "Name of the image to be released",
		},
		&cli.StringFlag{
			Name:     "repo",
			Required: true,
			Usage:    "AWS Marketplace ECR repository",
		},
		&cli.StringFlag{
			Name:     "product",
			Required: true,
			Usage:    "AWS Marketplace product identifier",
		},
	}
	return testApp
}

type mockAwsMarketplaceDocker struct {
	ImagePullError error
	ImageTagError  error
	ImagePushError error
}

func (m *mockAwsMarketplaceDocker) ImagePull(ctx context.Context, refStr string, options image.PullOptions) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader([]byte(""))), m.ImagePullError
}

func (m *mockAwsMarketplaceDocker) ImageTag(ctx context.Context, source string, target string) error {
	return m.ImageTagError
}

func (m *mockAwsMarketplaceDocker) ImagePush(ctx context.Context, image string, options image.PushOptions) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader([]byte(""))), m.ImagePushError
}

type mockAwsMarketplaceRegistry struct {
	GetAuthorizationTokenWithContextError error
}

func (m *mockAwsMarketplaceRegistry) GetAuthorizationTokenWithContext(ctx context.Context, input *ecr.GetAuthorizationTokenInput, opts ...request.Option) (*ecr.GetAuthorizationTokenOutput, error) {
	return &ecr.GetAuthorizationTokenOutput{
		AuthorizationData: []*ecr.AuthorizationData{
			{
				AuthorizationToken: aws.String(base64.StdEncoding.EncodeToString([]byte("username:password"))),
			},
		},
	}, m.GetAuthorizationTokenWithContextError
}

type mockAwsMarketplaceCatalog struct {
	DescribeEntityWithContextError error
	StartChangeSetWithContextError error
}

func (m *mockAwsMarketplaceCatalog) DescribeEntityWithContext(ctx context.Context, input *marketplacecatalog.DescribeEntityInput, opts ...request.Option) (*marketplacecatalog.DescribeEntityOutput, error) {
	return &marketplacecatalog.DescribeEntityOutput{
		EntityIdentifier: aws.String("productid"),
	}, m.DescribeEntityWithContextError
}

func (m *mockAwsMarketplaceCatalog) StartChangeSetWithContext(ctx context.Context, input *marketplacecatalog.StartChangeSetInput, opts ...request.Option) (*marketplacecatalog.StartChangeSetOutput, error) {
	return &marketplacecatalog.StartChangeSetOutput{}, m.StartChangeSetWithContextError
}
