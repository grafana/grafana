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
	Created         time.Time
	Updated         time.Time
}

// ---------------------
// COMMANDS

type CreateAccountCommand struct {
	Email    string `json:"email" binding:"required"`
	Login    string `json:"login"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name"`
	Company  string `json:"company"`
	Salt     string `json:"-"`
	IsAdmin  bool   `json:"-"`

	Result Account `json:"-"`
}

type UpdateAccountCommand struct {
	Email string `json:"email" binding:"required"`
	Login string `json:"login"`
	Name  string `json:"name"`

	AccountId int64 `json:"-"`
}

type SetUsingAccountCommand struct {
	AccountId      int64
	UsingAccountId int64
}

// ----------------------
// QUERIES

type GetAccountInfoQuery struct {
	Id     int64
	Result AccountDTO
}

type GetOtherAccountsQuery struct {
	AccountId int64
	Result    []*OtherAccountDTO
}

type GetAccountByIdQuery struct {
	Id     int64
	Result *Account
}

type GetAccountByLoginQuery struct {
	Login  string
	Result *Account
}

type SearchAccountsQuery struct {
	Query string
	Page  int
	Limit int

	Result []*AccountSearchHitDTO
}

// ------------------------
// DTO & Projections

type OtherAccountDTO struct {
	AccountId int64  `json:"accountId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	IsUsing   bool   `json:"isUsing"`
}

type AccountSearchHitDTO struct {
	Id      int64  `json:"id"`
	Name    string `json:"name"`
	Login   string `json:"login"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"isAdmin"`
}

type AccountDTO struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Login string `json:"login"`
}
