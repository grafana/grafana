package model

import (
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
)

func GetOrgs () ([]*models.OrgDTO, bool) {
  query := models.SearchOrgsQuery {
    Query: "",
    Name:  "",
    Page:  0,
    Limit: 1000,
  }

  err := bus.Dispatch(&query);
  return query.Result, (err == nil)
}
