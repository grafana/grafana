package models

import (
	"github.com/aws/aws-sdk-go/service/oam"
)

type Account struct {
	Arn                 string `json:"arn"`
	Label               string `json:"label"`
	IsMonitoringAccount bool   `json:"isMonitoringAccount"`
}

type OAMClientProvider interface {
	ListSinks(*oam.ListSinksInput) (*oam.ListSinksOutput, error)
	ListAttachedLinks(*oam.ListAttachedLinksInput) (*oam.ListAttachedLinksOutput, error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole() ([]*Account, error)
}

type ClientsProvider interface {
	OAMClientProvider
}
