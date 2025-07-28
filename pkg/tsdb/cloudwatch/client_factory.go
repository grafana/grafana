package cloudwatch

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/oam"
	"github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

// NewCWClient is a CloudWatch metrics api factory.
//
// Stubbable by tests.
var NewCWClient = func(cfg aws.Config) models.CWClient {
	return cloudwatch.NewFromConfig(cfg)
}

// NewLogsAPI is a CloudWatch logs api factory.
//
// Stubbable by tests.
var NewLogsAPI = func(cfg aws.Config) models.CloudWatchLogsAPIProvider {
	return cloudwatchlogs.NewFromConfig(cfg)
}

// NewOAMAPI is a CloudWatch OAM API factory
//
// Stubbable by tests.
var NewOAMAPI = func(cfg aws.Config) models.OAMAPIProvider {
	return oam.NewFromConfig(cfg)
}

// NewEC2API is a CloudWatch EC2 API factory
//
// Stubbable by tests
var NewEC2API = func(cfg aws.Config) models.EC2APIProvider {
	return ec2.NewFromConfig(cfg)
}

// NewCWLogsClient is a CloudWatch logs client factory.
//
// Stubbable by tests.
var NewCWLogsClient = func(cfg aws.Config) models.CWLogsClient {
	return cloudwatchlogs.NewFromConfig(cfg)
}

// NewRGTAClient is a ResourceGroupsTaggingAPI Client factory.
//
// Stubbable by tests.
var NewRGTAClient = func(cfg aws.Config) resourcegroupstaggingapi.GetResourcesAPIClient {
	return resourcegroupstaggingapi.NewFromConfig(cfg)
}
