package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetLocations(c *middleware.Context) {
	query := m.GetLocationsQuery{AccountId: c.Account.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to query locations", err)
		return
	}

	result := make([]*dtos.Location, len(query.Result))
	for i, l := range query.Result {
		result[i] = &dtos.Location{
			Id:        l.Id,
			AccountId: l.AccountId,
			Code:      l.Code,
			Name:      l.Name,
			Country:   l.Country,
			Region:    l.Region,
			Provider:  l.Provider,
		}
	}
	c.JSON(200, result)
}

func GetLocationByCode(c *middleware.Context) {
	code := c.Params(":code")

	query := m.GetLocationByCodeQuery{Code: code, AccountId: c.GetAccountId()}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Location not found", nil)
		return
	}

	result := &dtos.Location{
		Id:        query.Result.Id,
		AccountId: query.Result.AccountId,
		Code:      query.Result.Code,
		Name:      query.Result.Name,
		Country:   query.Result.Country,
		Region:    query.Result.Region,
		Provider:  query.Result.Provider,
	}

	c.JSON(200, result)
}

func DeleteLocation(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteLocationCommand{Id: id, AccountId: c.UserAccount.Id}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete location", err)
		return
	}

	c.JsonOK("location deleted")
}

func AddLocation(c *middleware.Context) {
	cmd := m.AddLocationCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.Account.Id

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add location", err)
		return
	}
	result := &dtos.Location{
		Id:        cmd.Result.Id,
		AccountId: cmd.Result.AccountId,
		Code:      cmd.Result.Code,
		Name:      cmd.Result.Name,
		Country:   cmd.Result.Country,
		Region:    cmd.Result.Region,
		Provider:  cmd.Result.Provider,
	}
	c.JSON(200, result)
}

func UpdateLocation(c *middleware.Context) {
	cmd := m.UpdateLocationCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.Account.Id

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update location", err)
		return
	}

	c.JsonOK("Location updated")
}
