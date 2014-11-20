package models

import (
	"errors"
	"time"
)

var (
	CreateAccount       func(acccount *Account) error
	UpdateAccount       func(acccount *Account) error
	GetAccountByLogin   func(emailOrName string) (*Account, error)
	GetAccount          func(accountId int64) (*Account, error)
	GetOtherAccountsFor func(accountId int64) ([]*OtherAccount, error)
)

// Typed errors
var (
	ErrAccountNotFound = errors.New("Account not found")
)

type CollaboratorLink struct {
	AccountId  int64
	Role       string
	Email      string
	ModifiedOn time.Time
	CreatedOn  time.Time
}

type OtherAccount struct {
	Id   int `gorethink:"id"`
	Name string
	Role string
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
	Collaborators   []CollaboratorLink `xorm:"-"`
	Created         time.Time          `xorm:"CREATED"`
	Updated         time.Time          `xorm:"UPDATED"`
}

func (account *Account) AddCollaborator(newCollaborator *Account) error {
	for _, collaborator := range account.Collaborators {
		if collaborator.AccountId == newCollaborator.Id {
			return errors.New("Collaborator already exists")
		}
	}

	account.Collaborators = append(account.Collaborators, CollaboratorLink{
		AccountId:  newCollaborator.Id,
		Email:      newCollaborator.Email,
		Role:       "admin",
		CreatedOn:  time.Now(),
		ModifiedOn: time.Now(),
	})

	return nil
}

func (account *Account) RemoveCollaborator(accountId int64) {
	list := account.Collaborators
	for i, collaborator := range list {
		if collaborator.AccountId == accountId {
			account.Collaborators = append(list[:i], list[i+1:]...)
			break
		}
	}
}

func (account *Account) HasCollaborator(accountId int64) bool {
	for _, collaborator := range account.Collaborators {
		if collaborator.AccountId == accountId {
			return true
		}
	}
	return false
}
