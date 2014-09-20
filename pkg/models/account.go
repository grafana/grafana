package models

import (
	"errors"
	"time"
)

type CollaboratorLink struct {
	AccountId  int
	Role       string
	ModifiedOn time.Time
	CreatedOn  time.Time
}

type Account struct {
	Id              int `gorethink:"id"`
	Version         int
	Login           string
	Email           string
	AccountName     string
	Password        string
	NextDashboardId int
	UsingAccountId  int
	Collaborators   []CollaboratorLink
	CreatedOn       time.Time
	ModifiedOn      time.Time
	LastLoginOn     time.Time
}

func (account *Account) AddCollaborator(accountId int) error {
	for _, collaborator := range account.Collaborators {
		if collaborator.AccountId == accountId {
			return errors.New("Collaborator already exists")
		}
	}

	account.Collaborators = append(account.Collaborators, CollaboratorLink{
		AccountId:  accountId,
		Role:       "admin",
		CreatedOn:  time.Now(),
		ModifiedOn: time.Now(),
	})

	return nil
}
