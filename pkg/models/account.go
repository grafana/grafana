package models

import (
	"errors"
	"time"
)

var (
	SaveAccount         func(account *Account) error
	GetAccountByLogin   func(emailOrName string) (*Account, error)
	GetAccount          func(accountId int64) (*Account, error)
	GetOtherAccountsFor func(accountId int64) ([]*OtherAccount, error)
)

// Typed errors
var (
	ErrAccountNotFound = errors.New("Account not found")
)

// Projection from User -> other account given access to
type OtherAccount struct {
	Id    int64
	Email string
	Role  string
}

type Account struct {
	Id              int64
	Login           string `xorm:"UNIQUE NOT NULL"`
	Email           string `xorm:"UNIQUE NOT NULL"`
	Name            string
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

// api projection model
type CollaboratorDTO struct {
	AccountId int64  `json:"accountId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
}

// api view projection
type AccountDTO struct {
	Email         string             `json:"email"`
	Name          string             `json:"name"`
	Collaborators []*CollaboratorDTO `json:"collaborators"`
}

// returns a view projection
type GetAccountInfoQuery struct {
	Id     int64
	Result AccountDTO
}
