package api

import (
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	thirtyDays = 30 * 24 * time.Hour
)

type deviceDTO struct {
	anonstore.Device
	LastSeenAt string `json:"lastSeenAt"`
	AvatarUrl  string `json:"avatarUrl"`
}

type AnonDeviceServiceAPI struct {
	cfg            *setting.Cfg
	store          anonstore.AnonStore
	accesscontrol  accesscontrol.AccessControl
	RouterRegister routing.RouteRegister
	log            log.Logger
}

func NewAnonDeviceServiceAPI(
	cfg *setting.Cfg,
	anonstore anonstore.AnonStore,
	accesscontrol accesscontrol.AccessControl,
	routerRegister routing.RouteRegister,
) *AnonDeviceServiceAPI {
	return &AnonDeviceServiceAPI{
		cfg:            cfg,
		store:          anonstore,
		accesscontrol:  accesscontrol,
		RouterRegister: routerRegister,
		log:            log.New("anon.api"),
	}
}

func (api *AnonDeviceServiceAPI) RegisterAPIEndpoints() {
	auth := accesscontrol.Middleware(api.accesscontrol)
	api.RouterRegister.Group("/api/anonymous", func(anonRoutes routing.RouteRegister) {
		anonRoutes.Get("/stats", auth(accesscontrol.EvalPermission(accesscontrol.ActionServerStatsRead)), routing.Wrap(api.CountDevices))
		anonRoutes.Get("/devices", auth(accesscontrol.EvalPermission(accesscontrol.ActionUsersRead)), routing.Wrap(api.ListDevices))
	})
}

// swagger:route GET /stats devices listDevices
//
// # Lists all devices within the last 30 days
//
// Produces:
// - application/json
//
// Responses:
//
//	200: devicesResponse
//	401: unauthorisedError
//	403: forbiddenError
//	404: notFoundError
//	500: internalServerError
func (api *AnonDeviceServiceAPI) ListDevices(c *contextmodel.ReqContext) response.Response {
	fromTime := time.Now().Add(-thirtyDays)
	toTime := time.Now().Add(time.Minute)

	devices, err := api.store.ListDevices(c.Req.Context(), &fromTime, &toTime)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to list devices", err)
	}

	// convert to response format
	resDevices := make([]*deviceDTO, 0, len(devices))
	for _, device := range devices {
		resDevices = append(resDevices, &deviceDTO{
			Device:     *device,
			LastSeenAt: util.GetAgeString(device.UpdatedAt),
			AvatarUrl:  dtos.GetGravatarUrl(device.DeviceID),
		})
	}

	return response.JSON(http.StatusOK, resDevices)
}

// swagger:route GET /devices countDevices
//
// # Counts the number of anonymous devices within the last 30 days
//
// This operation counts all anonymous devices that have been active within the last 30 days.
//
// Produces:
// - application/json
//
// Schemes: https
//
// Responses:
//
//	200: countDevicesResponse
//	401: unauthorisedError
//	403: forbiddenError
//	404: notFoundError
//	500: internalServerError
func (api *AnonDeviceServiceAPI) CountDevices(c *contextmodel.ReqContext) response.Response {
	fromTime := time.Now().Add(-thirtyDays)
	toTime := time.Now().Add(time.Minute)

	devices, err := api.store.CountDevices(c.Req.Context(), fromTime, toTime)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to list devices", err)
	}
	return response.JSON(http.StatusOK, struct {
		ActiveDevices int64 `json:"activeDevices"`
	}{ActiveDevices: devices})
}

// swagger:response DevicesResponse
type DevicesResponse struct {
	// in:body
	Body []deviceDTO `json:"body"`
}

// swagger:response CountDevicesResponse
type CountDevicesResponse struct {
	// in:body
	Body struct {
		ActiveDevices int64 `json:"count"`
	}
}
