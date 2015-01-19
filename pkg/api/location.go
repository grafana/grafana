package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetLocations(c *middleware.Context, query m.GetLocationsQuery) {
	query.AccountId = c.UsingAccountId

	log.Info("LocationId: %v, Slug: %v, Public %v", query.LocationId, query.Slug, query.Public)

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query locations", err)
		return
	}

	result := make([]*dtos.Location, len(query.Result))
	for i, l := range query.Result {
		result[i] = &dtos.Location{
			Id:       l.Id,
			Slug:     l.Slug,
			Name:     l.Name,
			Country:  l.Country,
			Region:   l.Region,
			Provider: l.Provider,
			Public:   l.Public,
		}
	}
	c.JSON(200, result)
}

func GetLocationBySlug(c *middleware.Context) {
	slug := c.Params(":slug")

	query := m.GetLocationBySlugQuery{Slug: slug, AccountId: c.UsingAccountId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Location not found", nil)
		return
	}

	result := &dtos.Location{
		Id:       query.Result.Id,
		Slug:     query.Result.Slug,
		Name:     query.Result.Name,
		Country:  query.Result.Country,
		Region:   query.Result.Region,
		Provider: query.Result.Provider,
		Public:   query.Result.Public,
	}

	c.JSON(200, result)
}

func DeleteLocation(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteLocationCommand{Id: id, AccountId: c.UsingAccountId}

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

	cmd.AccountId = c.UsingAccountId
	if cmd.Public {
		if c.IsGrafanaAdmin != true {
			c.JsonApiErr(400, "Only admins can make public locations", nil)
			return
		}
	}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add location", err)
		return
	}
	result := &dtos.Location{
		Id:       cmd.Result.Id,
		Slug:     cmd.Result.Slug,
		Name:     cmd.Result.Name,
		Country:  cmd.Result.Country,
		Region:   cmd.Result.Region,
		Provider: cmd.Result.Provider,
		Public:   cmd.Public,
	}
	c.JSON(200, result)
}

func UpdateLocation(c *middleware.Context) {
	cmd := m.UpdateLocationCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation failed", nil)
		return
	}

	cmd.AccountId = c.UsingAccountId
	if cmd.Public {
		if c.IsGrafanaAdmin != true {
			c.JsonApiErr(400, "Only admins can make public locations", nil)
			return
		}
	}
	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update location", err)
		return
	}

	c.JsonOK("Location updated")
}
