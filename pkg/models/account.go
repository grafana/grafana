package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrAccountNotFound = errors.New("Account not found")
)

type Account struct {
	Id      int64
	Version int
	Name    string
	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateAccountCommand struct {
	Name string `json:"name" binding:"Required"`

	// initial admin user for account
	UserId int64   `json:"-"`
	Result Account `json:"-"`
}

type UpdateAccountCommand struct {
	Name      string `json:"name" binding:"Required"`
	AccountId int64  `json:"-"`
}

type GetUserAccountsQuery struct {
	UserId int64
	Result []*UserAccountDTO
}

type GetAccountByIdQuery struct {
	Id     int64
	Result *Account
}

type GetAccountByNameQuery struct {
	Name   string
	Result *Account
}

type GetAccountsQuery struct {
	Result []*Account
}

type AccountDTO struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}

type UserAccountDTO struct {
	AccountId int64    `json:"accountId"`
	Name      string   `json:"name"`
	Role      RoleType `json:"role"`
	IsUsing   bool     `json:"isUsing"`
}
