package cloudwatch

import (
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

// NewMetricsAPI is a CloudWatch metrics api factory.
//
// Stubbable by tests.
var NewMetricsAPI = func(sess *session.Session) models.CloudWatchMetricsAPIProvider {
	return cloudwatch.New(sess)
}

// NewLogsAPI is a CloudWatch logs api factory.
//
// Stubbable by tests.
var NewLogsAPI = func(sess *session.Session) models.CloudWatchLogsAPIProvider {
	return cloudwatchlogs.New(sess)
}

// NewOAMAPI is a CloudWatch OAM api factory.
//
// Stubbable by tests.
var NewOAMAPI = func(sess *session.Session) models.OAMAPIProvider {
	return oam.New(sess)
}

// NewCWClient is a CloudWatch client factory.
//
// Stubbable by tests.
var NewCWClient = func(sess *session.Session) cloudwatchiface.CloudWatchAPI {
	return cloudwatch.New(sess)
}

// NewCWLogsClient is a CloudWatch logs client factory.
//
// Stubbable by tests.
var NewCWLogsClient = func(sess *session.Session) cloudwatchlogsiface.CloudWatchLogsAPI {
	return cloudwatchlogs.New(sess)
}

// NewEC2Client is a client factory.
//
// Stubbable by tests.
var NewEC2Client = func(provider client.ConfigProvider) models.EC2APIProvider {
	return ec2.New(provider)
}

// RGTA client factory.
//
// Stubbable by tests.
var newRGTAClient = func(provider client.ConfigProvider) resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI {
	return resourcegroupstaggingapi.New(provider)
}
