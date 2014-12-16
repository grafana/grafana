package models

import (
	"errors"
	"time"
)

var (
	SaveAccount                func(account *Account) error
	GetAccountByLogin          func(emailOrName string) (*Account, error)
	GetAccount                 func(accountId int64) (*Account, error)
	GetOtherAccountsFor        func(accountId int64) ([]*OtherAccount, error)
	GetCollaboratorsForAccount func(accountId int64) ([]*CollaboratorInfo, error)
	AddCollaborator            func(collaborator *Collaborator) error
)

// Typed errors
var (
	ErrAccountNotFound = errors.New("Account not found")
)

type OtherAccount struct {
	Id    int64
	Email string
	Role  string
}

type Account struct {
	Id              int64
	Login           string `xorm:"UNIQUE NOT NULL"`
	Email           string `xorm:"UNIQUE NOT NULL"`
	Name            string `xorm:"UNIQUE NOT NULL"`
	FullName        string
	Password        string
	IsAdmin         bool
	Salt            string `xorm:"VARCHAR(10)"`
	Company         string
	NextDashboardId int
	UsingAccountId  int64

	Created time.Time
	Updated time.Time
}
