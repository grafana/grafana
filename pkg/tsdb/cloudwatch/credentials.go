package cloudwatch

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
)

// Session factory.
// Stubbable by tests.
//nolint:gocritic
var newSession = func(cfgs ...*aws.Config) (*session.Session, error) {
	return session.NewSession(cfgs...)
}

// STS credentials factory.
// Stubbable by tests.
//nolint:gocritic
var newSTSCredentials = stscreds.NewCredentials

// EC2Metadata service factory.
// Stubbable by tests.
//nolint:gocritic
var newEC2Metadata = ec2metadata.New
