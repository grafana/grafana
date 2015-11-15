package models


type AlertSource struct {
  OrgId   int64
  Version int

  Url     string
}

type GetAlertSourceQuery struct {
  OrgId  int64
  Result AlertSource
}
