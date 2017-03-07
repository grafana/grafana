package models

import "time"

type Status string

const (
  ProposeStarted string = "Start"
  ProposeChecked string = "Check"
  ProposeComplete string = "Complete"
)

type ProposeUser struct {
  Id      int64
  Email   string
  Name    string
  Phone   string
  Org     string
  Scale   string
  Status  string
  Created time.Time
}

// ---------------------
// COMMANDS

type CreateProposeUserCommand struct {
  Email  string
  Name   string
  Phone  string
  Org    string
  Scale  string

  Result *ProposeUser
}

type UpdateProposeUserStatus struct {
  Id     int64
  Status string
}

// ----------------------
// QUERIES
type GetAllProposeUsers struct {
  Result []*ProposeUser
}
