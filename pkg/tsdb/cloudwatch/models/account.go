package models

import (
	"github.com/aws/aws-sdk-go/service/oam"
)

type Account struct {
	Id                  string `json:"id"`
	Arn                 string `json:"arn"`
	Label               string `json:"label"`
	IsMonitoringAccount bool   `json:"isMonitoringAccount"`
}

type OAMClientProvider interface {
	ListSinks(*oam.ListSinksInput) (*oam.ListSinksOutput, error)
	ListAttachedLinks(*oam.ListAttachedLinksInput) (*oam.ListAttachedLinksOutput, error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole() ([]ResourceResponse[*Account], error)
}

type ClientsProvider interface {
	OAMClientProvider
}
