package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

var ErrAccessDeniedException = errors.New("access denied. please check your IAM policy")

type AccountsService struct {
	models.OAMAPIProvider
}

func NewAccountsService(oamClient models.OAMAPIProvider) models.AccountsProvider {
	return &AccountsService{oamClient}
}

func (a *AccountsService) GetAccountsForCurrentUserOrRole(ctx context.Context) ([]resources.ResourceResponse[resources.Account], error) {
	var nextToken *string
	sinks := []*oam.ListSinksItem{}
	for {
		response, err := a.ListSinksWithContext(ctx, &oam.ListSinksInput{NextToken: nextToken})
		if err != nil {
			var aerr awserr.Error
			if errors.As(err, &aerr) {
				switch aerr.Code() {
				// unlike many other services, OAM doesn't define this error code. however, it's returned in case calling role/user has insufficient permissions
				case "AccessDeniedException":
					return nil, fmt.Errorf("%w: %s", ErrAccessDeniedException, aerr.Message())
				}
			}
		}
		if err != nil {
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
		links, err := a.ListAttachedLinksWithContext(ctx, &oam.ListAttachedLinksInput{
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

	return valuesToListMetricRespone(response), nil
}
