package models

import "time"

type User struct {
	Id       int64
	Email    string
	Name     string
	Login    string
	Password string
	Salt     string

	IsAdmin   bool
	AccountId int64

	Created time.Time
	Updated time.Time
}

type Account2 struct {
	Id      int64
	Name    string
	Created time.Time
	Updated time.Time
}

type AccountUser struct {
	AccountId int64
	UserId    int64
	Role      RoleType
	Created   time.Time
	Updated   time.Time
}

// ---------------------
// COMMANDS

type CreateUserCommand struct {
	Email    string
	Login    string
	Password string
	Salt     string
	IsAdmin  bool

	Result User `json:"-"`
}
