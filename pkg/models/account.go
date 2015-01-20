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
	Name    string
	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateAccountCommand struct {
	Name string `json:"name"`

	Result Account `json:"-"`
}

type UpdateAccountCommand struct {
	Name      string `json:"name"`
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

type UserAccountDTO struct {
	AccountId int64    `json:"accountId"`
	Name      string   `json:"email"`
	Role      RoleType `json:"role"`
	IsUsing   bool     `json:"isUsing"`
}
