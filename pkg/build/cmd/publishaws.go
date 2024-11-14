package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ecr"
	"github.com/aws/aws-sdk-go/service/marketplacecatalog"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
)

const (
	marketplaceChangeSetName  = "Add new version"
	marketplaceCatalogId      = "AWSMarketplace"
	marketplaceRegistryId     = "709825985650"
	marketplaceRegistryRegion = "us-east-1"
	marketplaceRegistryUrl    = "709825985650.dkr.ecr.us-east-1.amazonaws.com"
	marketplaceRequestsUrl    = "https://aws.amazon.com/marketplace/management/requests/"
	releaseNotesTemplateUrl   = "https://grafana.com/docs/grafana/latest/release-notes/release-notes-${TAG}/"
	helmChartsUrl             = "https://grafana.github.io/helm-charts/"
	docsUrl                   = "https://grafana.com/docs/grafana/latest/enterprise/license/"
	imagePlatform             = "linux/amd64"

	publishAwsMarketplaceTestKey publishAwsMarketplaceTestKeyType = "test-client"
)

var (
	errEmptyVersion = errors.New(`failed to retrieve release version from metadata, use "--version" to set it manually`)
)

type publishAwsMarketplaceTestKeyType string

type publishAwsMarketplaceFlags struct {
	dryRun  bool
	version string
	repo    string
	image   string
	product string
}

type AwsMarketplacePublishingService struct {
	auth   string
	docker AwsMarketplaceDocker
	ecr    AwsMarketplaceRegistry
	mkt    AwsMarketplaceCatalog
}

type AwsMarketplaceDocker interface {
	ImagePull(ctx context.Context, refStr string, options types.ImagePullOptions) (io.ReadCloser, error)
	ImageTag(ctx context.Context, source string, target string) error
	ImagePush(ctx context.Context, image string, options types.ImagePushOptions) (io.ReadCloser, error)
}

type AwsMarketplaceRegistry interface {
	GetAuthorizationTokenWithContext(ctx context.Context, input *ecr.GetAuthorizationTokenInput, opts ...request.Option) (*ecr.GetAuthorizationTokenOutput, error)
}

type AwsMarketplaceCatalog interface {
	DescribeEntityWithContext(ctx context.Context, input *marketplacecatalog.DescribeEntityInput, opts ...request.Option) (*marketplacecatalog.DescribeEntityOutput, error)
	StartChangeSetWithContext(ctx context.Context, input *marketplacecatalog.StartChangeSetInput, opts ...request.Option) (*marketplacecatalog.StartChangeSetOutput, error)
}

func PublishAwsMarketplace(ctx *cli.Context) error {
	f, err := getPublishAwsMarketplaceFlags(ctx)
	if err != nil {
		return err
	}

	if f.version == "" {
		return errEmptyVersion
	}

	svc, err := getAwsMarketplacePublishingService()
	if err != nil {
		return err
	}

	if ctx.Context.Value(publishAwsMarketplaceTestKey) != nil {
		svc = ctx.Context.Value(publishAwsMarketplaceTestKey).(*AwsMarketplacePublishingService)
	}

	fmt.Println("Logging in to AWS Marketplace registry")
	err = svc.Login(ctx.Context)
	if err != nil {
		return err
	}

	fmt.Printf("Retrieving image '%s:%s' from Docker Hub\n", f.image, f.version)
	err = svc.PullImage(ctx.Context, f.image, f.version)
	if err != nil {
		return err
	}

	fmt.Printf("Renaming image '%s:%s' to '%s/%s:%s'\n", f.image, f.version, marketplaceRegistryUrl, f.repo, f.version)
	err = svc.TagImage(ctx.Context, f.image, f.repo, f.version)
	if err != nil {
		return err
	}

	if !f.dryRun {
		fmt.Printf("Pushing image '%s/%s:%s' to the AWS Marketplace ECR\n", marketplaceRegistryUrl, f.repo, f.version)
		err = svc.PushToMarketplace(ctx.Context, f.repo, f.version)
		if err != nil {
			return err
		}
	} else {
		fmt.Printf("Dry-Run: Pushing image '%s/%s:%s' to the AWS Marketplace ECR\n", marketplaceRegistryUrl, f.repo, f.version)
	}

	fmt.Printf("Retrieving product identifier for product '%s'\n", f.product)
	pid, err := svc.GetProductIdentifier(ctx.Context, f.product)
	if err != nil {
		return err
	}

	if !f.dryRun {
		fmt.Printf("Releasing to product, you can view the progress of the release on %s\n", marketplaceRequestsUrl)
		return svc.ReleaseToProduct(ctx.Context, pid, f.repo, f.version)
	} else {
		fmt.Printf("Dry-Run: Releasing to product, you can view the progress of the release on %s\n", marketplaceRequestsUrl)
	}

	return nil
}

func getAwsMarketplacePublishingService() (*AwsMarketplacePublishingService, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	mySession := session.Must(session.NewSession())
	ecr := ecr.New(mySession, aws.NewConfig().WithRegion(marketplaceRegistryRegion))
	mkt := marketplacecatalog.New(mySession, aws.NewConfig().WithRegion(marketplaceRegistryRegion))
	return &AwsMarketplacePublishingService{
		docker: cli,
		ecr:    ecr,
		mkt:    mkt,
	}, nil
}

func (s *AwsMarketplacePublishingService) Login(ctx context.Context) error {
	out, err := s.ecr.GetAuthorizationTokenWithContext(ctx, &ecr.GetAuthorizationTokenInput{})
	if err != nil {
		return err
	}
	s.auth = *out.AuthorizationData[0].AuthorizationToken
	authData, err := base64.StdEncoding.DecodeString(s.auth)
	if err != nil {
		return err
	}
	authString := strings.Split(string(authData), ":")
	authData, err = json.Marshal(registry.AuthConfig{
		Username: authString[0],
		Password: authString[1],
	})
	s.auth = base64.StdEncoding.EncodeToString(authData)
	return err
}

func (s *AwsMarketplacePublishingService) PullImage(ctx context.Context, image string, version string) error {
	reader, err := s.docker.ImagePull(ctx, fmt.Sprintf("%s:%s", image, version), types.ImagePullOptions{
		Platform: imagePlatform,
	})
	if err != nil {
		return err
	}

	_, err = io.Copy(os.Stdout, reader)
	if err != nil {
		return err
	}

	err = reader.Close()
	if err != nil {
		return err
	}
	return nil
}

func (s *AwsMarketplacePublishingService) TagImage(ctx context.Context, image string, repo string, version string) error {
	err := s.docker.ImageTag(ctx, fmt.Sprintf("%s:%s", image, version), fmt.Sprintf("%s/%s:%s", marketplaceRegistryUrl, repo, version))
	if err != nil {
		return err
	}
	return nil
}

func (s *AwsMarketplacePublishingService) PushToMarketplace(ctx context.Context, repo string, version string) error {
	reader, err := s.docker.ImagePush(ctx, fmt.Sprintf("%s/%s:%s", marketplaceRegistryUrl, repo, version), types.ImagePushOptions{
		RegistryAuth: s.auth,
	})
	if err != nil {
		return err
	}

	_, err = io.Copy(os.Stdout, reader)
	if err != nil {
		return err
	}

	err = reader.Close()
	if err != nil {
		return err
	}
	return nil
}

func (s *AwsMarketplacePublishingService) GetProductIdentifier(ctx context.Context, product string) (string, error) {
	out, err := s.mkt.DescribeEntityWithContext(ctx, &marketplacecatalog.DescribeEntityInput{
		EntityId: aws.String(product),
		Catalog:  aws.String(marketplaceCatalogId),
	})
	if err != nil {
		return "", err
	}
	return *out.EntityIdentifier, nil
}

func (s *AwsMarketplacePublishingService) ReleaseToProduct(ctx context.Context, pid string, repo string, version string) error {
	_, err := s.mkt.StartChangeSetWithContext(ctx, &marketplacecatalog.StartChangeSetInput{
		Catalog:       aws.String(marketplaceCatalogId),
		ChangeSetName: aws.String(marketplaceChangeSetName),
		ChangeSet: []*marketplacecatalog.Change{
			buildAwsMarketplaceChangeSet(pid, repo, version),
		},
	})
	return err
}

func getPublishAwsMarketplaceFlags(ctx *cli.Context) (*publishAwsMarketplaceFlags, error) {
	metadata, err := config.GenerateMetadata(ctx)
	if err != nil {
		return nil, err
	}
	version := ctx.String("version")
	if version == "" && metadata.GrafanaVersion != "" {
		version = metadata.GrafanaVersion
	}
	image := ctx.String("image")
	repo := ctx.String("repo")
	product := ctx.String("product")
	dryRun := ctx.Bool("dry-run")
	return &publishAwsMarketplaceFlags{
		dryRun:  dryRun,
		version: version,
		image:   image,
		repo:    repo,
		product: product,
	}, nil
}

func buildAwsMarketplaceReleaseNotesUrl(version string) string {
	sanitizedVersion := strings.ReplaceAll(version, ".", "-")
	return strings.ReplaceAll(releaseNotesTemplateUrl, "${TAG}", sanitizedVersion)
}

func buildAwsMarketplaceChangeSet(entityId string, repo string, version string) *marketplacecatalog.Change {
	return &marketplacecatalog.Change{
		ChangeType: aws.String("AddDeliveryOptions"),
		Entity: &marketplacecatalog.Entity{
			Type:       aws.String("ContainerProduct@1.0"),
			Identifier: aws.String(entityId),
		},
		Details: aws.String(buildAwsMarketplaceVersionDetails(repo, version)),
	}
}

func buildAwsMarketplaceVersionDetails(repo string, version string) string {
	releaseNotesUrl := buildAwsMarketplaceReleaseNotesUrl(version)
	return fmt.Sprintf(`{
        "Version": {
          "ReleaseNotes": "Release notes are available on the website %s",
          "VersionTitle": "v%s"
        },
        "DeliveryOptions": [
          {
            "Details": {
              "EcrDeliveryOptionDetails": {
                "DeploymentResources": [
                  {
                    "Name": "Helm Charts",
                    "Url": "%s"
                  }
                ],
                "CompatibleServices": ["EKS", "ECS", "ECS-Anywhere", "EKS-Anywhere"],
                "ContainerImages": ["%s/%s:%s"],
                "Description": "Grafana Enterprise can be installed using the official Grafana Helm chart repository. The repository is available on Github: %s",
                "UsageInstructions": "You can apply your Grafana Enterprise license to a new or existing Grafana Enterprise deployment by updating a configuration setting or environment variable. Your Grafana instance must be deployed on AWS, or have network access to AWS. For more information, see %s"
              }
            },
            "DeliveryOptionTitle": "Helm Chart"
          }
        ]
      }`, releaseNotesUrl, version, helmChartsUrl, marketplaceRegistryUrl, repo, version, helmChartsUrl, docsUrl)
}
