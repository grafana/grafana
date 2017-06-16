package models

import (
  "errors"
)

// Typed errors
var (
  ErrAddSystem          = errors.New("Cannot create new System")
  ErrSystemAlreadyAdded = errors.New("Cannot create System, name exist")
)

type Systems struct {
  Id          int64
  SystemsName string
  Slug        string
  OrgId       int64
}


type OrgSystems struct {
  Org       Org
  Systems []*Systems
}

type SystemUser struct {
  Id          int64
  SystemId    string
  UserId      string
}

type SystemDash struct {
  Id            int64
  SystemId      int64
  DashboardId   int64
}

type SystemPick struct {
  Id            int64
  UserId        string
  SystemId      int64
}

// ---------------------
// COMMANDS
type AddSystemsCommand struct {
  SystemsName  []string
  OrgId        int64
}

type AddSystemsUserCommand struct {
  SystemsId   []string
  InviteCode  string
}

type AddSystemDashboardCommand struct {
  DashId      string
  SystemId    int64
}

type UpdateSystemDashboardCommand struct {
  DashId      string
  SystemId    int64
}

type UpdateUserSystemCommond struct {
  InviteCode string
  UserId     int64
}

type AddOrUpdateSystemPick struct {
  UserId        string
  SystemId      int64
}

// ----------------------
// QUERIES
type GetOrgSystemsQuery struct {
  OrgId  int64
  Result []*Systems
}

type GetUserSystemsQuery struct {
  UserId  int64
  Result []*Systems
}

type GetCurrentDashboardDashboard struct {
  UserId  int64
  Result  []*SystemDash
}

type GetCurrentSystemDashboards struct {
  SystemId  int64
  Result    []*SystemDash
}

type GetSystemPick struct {
  UserId  string
  Result  *SystemPick
}