package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/oam"
	oamtypes "github.com/aws/aws-sdk-go-v2/service/oam/types"
	"github.com/aws/smithy-go"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestHandleGetAccounts(t *testing.T) {
	t.Run("Should return an error in case of insufficient permissions from ListSinks", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{}, fmt.Errorf("%w", &smithy.GenericAPIError{Code: "AccessDeniedException", Message: "this is bad"}))
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, "access denied. please check your IAM policy: this is bad", err.Error())
		assert.ErrorIs(t, err, ErrAccessDeniedException)
	})

	t.Run("Should return an error in case of any error from ListSinks", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{}, fmt.Errorf("some error"))
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, err.Error(), "ListSinks error: some error")
	})

	t.Run("Should return empty array in case no monitoring account exists", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{}, nil)
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.NoError(t, err)
		assert.Empty(t, resp)
	})

	t.Run("Should return one monitoring account (the first) even though ListSinks returns multiple sinks", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 1"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1")},
				{Name: aws.String("Account 2"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group2")},
			},
			NextToken: new(string),
		}, nil).Once()
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 3"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group3")},
			},
			NextToken: nil,
		}, nil)
		fakeOAMClient.On("ListAttachedLinks", mock.Anything).Return(&oam.ListAttachedLinksOutput{}, nil)
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.NoError(t, err)
		fakeOAMClient.AssertNumberOfCalls(t, "ListSinks", 2)
		require.Len(t, resp, 1)
		assert.True(t, resp[0].Value.IsMonitoringAccount)
		assert.Equal(t, "Account 1", resp[0].Value.Label)
		assert.Equal(t, "arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1", resp[0].Value.Arn)
	})

	t.Run("Should merge the first sink with attached links", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 1"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1")},
				{Name: aws.String("Account 2"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group2")},
			},
			NextToken: new(string),
		}, nil).Once()
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 3"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group3")},
			},
			NextToken: nil,
		}, nil)
		fakeOAMClient.On("ListAttachedLinks", mock.Anything).Return(&oam.ListAttachedLinksOutput{
			Items: []oamtypes.ListAttachedLinksItem{
				{Label: aws.String("Account 10"), LinkArn: aws.String("arn:aws:logs:us-east-1:123456789013:log-group:my-log-group10")},
				{Label: aws.String("Account 11"), LinkArn: aws.String("arn:aws:logs:us-east-1:123456789014:log-group:my-log-group11")},
			},
			NextToken: new(string),
		}, nil).Once()
		fakeOAMClient.On("ListAttachedLinks", mock.Anything).Return(&oam.ListAttachedLinksOutput{
			Items: []oamtypes.ListAttachedLinksItem{
				{Label: aws.String("Account 12"), LinkArn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group12")},
			},
			NextToken: nil,
		}, nil)
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.NoError(t, err)
		fakeOAMClient.AssertNumberOfCalls(t, "ListSinks", 2)
		fakeOAMClient.AssertNumberOfCalls(t, "ListAttachedLinks", 2)
		expectedAccounts := []resources.ResourceResponse[resources.Account]{
			{Value: resources.Account{Id: "123456789012", Label: "Account 1", Arn: "arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1", IsMonitoringAccount: true}},
			{Value: resources.Account{Id: "123456789013", Label: "Account 10", Arn: "arn:aws:logs:us-east-1:123456789013:log-group:my-log-group10", IsMonitoringAccount: false}},
			{Value: resources.Account{Id: "123456789014", Label: "Account 11", Arn: "arn:aws:logs:us-east-1:123456789014:log-group:my-log-group11", IsMonitoringAccount: false}},
			{Value: resources.Account{Id: "123456789012", Label: "Account 12", Arn: "arn:aws:logs:us-east-1:123456789012:log-group:my-log-group12", IsMonitoringAccount: false}},
		}
		assert.Equal(t, expectedAccounts, resp)
	})

	t.Run("Should call ListAttachedLinks with arn of first sink", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 1"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1")},
			},
			NextToken: new(string),
		}, nil).Once()
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{
				{Name: aws.String("Account 3"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group3")},
			},
			NextToken: nil,
		}, nil).Once()
		fakeOAMClient.On("ListAttachedLinks", mock.Anything).Return(&oam.ListAttachedLinksOutput{}, nil)
		accounts := NewAccountsService(fakeOAMClient)

		_, _ = accounts.GetAccountsForCurrentUserOrRole(context.Background())

		fakeOAMClient.AssertCalled(t, "ListAttachedLinks", &oam.ListAttachedLinksInput{
			SinkIdentifier: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1"),
		})
	})

	t.Run("Should return an error in case of any error from ListAttachedLinks", func(t *testing.T) {
		fakeOAMClient := &mocks.FakeOAMClient{}
		fakeOAMClient.On("ListSinks", mock.Anything).Return(&oam.ListSinksOutput{
			Items: []oamtypes.ListSinksItem{{Name: aws.String("Account 1"), Arn: aws.String("arn:aws:logs:us-east-1:123456789012:log-group:my-log-group1")}},
		}, nil)
		fakeOAMClient.On("ListAttachedLinks", mock.Anything).Return(&oam.ListAttachedLinksOutput{}, fmt.Errorf("some error")).Once()
		accounts := NewAccountsService(fakeOAMClient)

		resp, err := accounts.GetAccountsForCurrentUserOrRole(context.Background())

		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, err.Error(), "ListAttachedLinks error: some error")
	})
}
