package services

import (
	"context"
	"errors"
	"fmt"

	oam "github.com/aws/aws-sdk-go-v2/service/oam"
	oamtypes "github.com/aws/aws-sdk-go-v2/service/oam/types"
	"github.com/aws/smithy-go"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

var ErrAccessDeniedException = errors.New("access denied. please check your IAM policy")

type AccountsService struct {
	models.OAMAPIProvider
}

var NewAccountsService = func(oamClient models.OAMAPIProvider) models.AccountsProvider {
	return &AccountsService{oamClient}
}

func (a *AccountsService) GetAccountsForCurrentUserOrRole(ctx context.Context) ([]resources.ResourceResponse[resources.Account], error) {
	var nextToken *string
	sinks := []oamtypes.ListSinksItem{}
	for {
		response, err := a.ListSinks(ctx, &oam.ListSinksInput{NextToken: nextToken})
		if err != nil {
			smithyErr := &smithy.GenericAPIError{}
			if errors.As(err, &smithyErr) && smithyErr.Code == "AccessDeniedException" {
				return nil, fmt.Errorf("%w: %s", ErrAccessDeniedException, smithyErr.Message)
			}
			return nil, fmt.Errorf("ListSinks error: %w", err)
		}

		sinks = append(sinks, response.Items...)

		if response.NextToken == nil {
			break
		}
		nextToken = response.NextToken
	}

	if len(sinks) == 0 {
		return nil, nil
	}

	sinkIdentifier := sinks[0].Arn
	response := []resources.Account{{
		Id:                  getAccountId(*sinkIdentifier),
		Label:               *sinks[0].Name,
		Arn:                 *sinkIdentifier,
		IsMonitoringAccount: true,
	}}

	nextToken = nil
	for {
		links, err := a.ListAttachedLinks(ctx, &oam.ListAttachedLinksInput{
			SinkIdentifier: sinkIdentifier,
			NextToken:      nextToken,
		})
		if err != nil {
			return nil, fmt.Errorf("ListAttachedLinks error: %w", err)
		}

		for _, link := range links.Items {
			arn := *link.LinkArn
			response = append(response, resources.Account{
				Id:                  getAccountId(arn),
				Label:               *link.Label,
				Arn:                 arn,
				IsMonitoringAccount: false,
			})
		}

		if links.NextToken == nil {
			break
		}
		nextToken = links.NextToken
	}

	return valuesToListMetricResponse(response), nil
}
