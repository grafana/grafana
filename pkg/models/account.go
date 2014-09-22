package models

import (
	"errors"
	"time"
)

type CollaboratorLink struct {
	AccountId  int
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
	Id              int `gorethink:"id"`
	Version         int
	Login           string
	Email           string
	AccountName     string
	Password        string
	Name            string
	NextDashboardId int
	UsingAccountId  int
	Collaborators   []CollaboratorLink
	CreatedOn       time.Time
	ModifiedOn      time.Time
	LastLoginOn     time.Time
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

func (account *Account) RemoveCollaborator(accountId int) {
	list := account.Collaborators
	for i, collaborator := range list {
		if collaborator.AccountId == accountId {
			account.Collaborators = append(list[:i], list[i+1:]...)
			break
		}
	}
}

func (account *Account) HasCollaborator(accountId int) bool {
	for _, collaborator := range account.Collaborators {
		if collaborator.AccountId == accountId {
			return true
		}
	}
	return false
}
