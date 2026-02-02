package api

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// Add a comment to add the query endpoint in ds_proxy.go
func (hs *HTTPServer) Usagedata(c *contextmodel.ReqContext) response.Response {

	predefinedQuery := c.Query("predefinedQuery")

	if predefinedQuery == "" {
		msg := "no value set for predefinedQuery parameter"
		hs.log.Error(msg)
		return hs.FailResponse(errors.New(msg))

	}

	if strings.EqualFold(predefinedQuery, "plugininfo") {

		res, err := hs.usagedataService.GetDashboardsUsingDeprecatedPlugins(c.Req.Context(), c.OrgID)
		if err != nil {
			return hs.FailResponse(err)
		}
		availablePlugins, err := hs.availablePlugins(c.Req.Context(), c.OrgID)
		if err == nil {
			panels := make(map[string]plugins.PanelDTO)
			for _, ap := range availablePlugins[plugins.TypePanel] {
				panel := ap.Plugin

				panels[panel.ID] = plugins.PanelDTO{
					ID:      panel.ID,
					Name:    panel.Name,
					Angular: panel.Angular,
				}
			}
			for i := range res.Data {
				if _, ok := panels[res.Data[i].PluginType]; ok {
					// For now, considering plugin deprecated
					// if it is dependent on Angular
					res.Data[i].Deprecated = panels[res.Data[i].PluginType].Angular.Detected
				}
			}
		}

		return hs.SuccessResponse(res)

	} else if strings.EqualFold(predefinedQuery, "rolesandpermissions") {

		user_id := c.Query("user_id")
		res, err := hs.usagedataService.GetRolesAndPermissions(c.Req.Context(), c.OrgID, hs.dashboardPermissionsService, hs.folderPermissionsService, user_id)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)
	} else if strings.EqualFold(predefinedQuery, "usercount") {
		loginId := c.Query("loginId")
		status := c.Query("status")
		useridentifier := c.Query("useridentifier")
		if !strings.EqualFold(status, "active") {
			status = "all"
		}
		res, err := hs.usagedataService.GetUserData(c.Req.Context(), c.OrgID, loginId, status, useridentifier)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)

	} else if strings.EqualFold(predefinedQuery, "dashboard") {
		folder := c.Query("folder")
		title := c.Query("title")
		status := c.Query("status")
		if !strings.EqualFold(status, "active") {
			status = "all"
		}
		res, err := hs.usagedataService.GetDashboardDetails(c.Req.Context(), c.OrgID, folder, title, status)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)
	} else if strings.EqualFold(predefinedQuery, "individualdashboardstats") {
		dashboardID, err := GetIdFromStrId(c.Query("dashboardID"))
		if err != nil {
			return hs.FailResponse(err)
		}

		res, err := hs.usagedataService.GetIndividualDashboardStats(c.Req.Context(), dashboardID, c.OrgID)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)
	} else if strings.EqualFold(predefinedQuery, "activedashboardscount") {
		res, err := hs.usagedataService.GetActiveDashboardsCount(c.Req.Context(), c.OrgID)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)
	} else if strings.EqualFold(predefinedQuery, "datavolume") {
		// Convert fromTime and endTime from epoch seconds to date time format to seconds for the Unix() method
		from := c.Query("from")
		to := c.Query("to")

		const dbDateTimeFormat = "2006-01-02 15:04:05 -0700"

		// Grafana dashboard time variable is in milliseconds by default, so we are expecting that and converting to int before formatting to a postgres compatible format.
		var fromTimeInt, toTimeInt int64

		if to == "" {
			// default toTime when param is missing
			toTimeInt = time.Now().UnixMilli()
		} else {
			_temp, err := strconv.ParseInt(to, 10, 0)
			if err != nil {
				return hs.FailResponse(err)
			}
			toTimeInt = _temp
		}

		_temp, err := strconv.ParseInt(from, 10, 0)
		if err != nil {
			return hs.FailResponse(err)
		}
		fromTimeInt = _temp
		

		formattedFromTime := time.UnixMilli(fromTimeInt).Format(dbDateTimeFormat)
		formattedToTime := time.UnixMilli(toTimeInt).Format(dbDateTimeFormat)

		dsIDStr := c.Query("datasourceID")

		var datasourceID int64

		if dsIDStr == "" {
			// optional param → default behavior
			datasourceID = 0
		} else {
			datasourceID, err = GetIdFromStrId(dsIDStr)
			if err != nil {
				return hs.FailResponse(err)
			}
		}
		res, err := hs.usagedataService.GetDataVolume(c.Req.Context(), c.OrgID, datasourceID, formattedFromTime, formattedToTime)
		if err != nil {
			return hs.FailResponse(err)
		}
		return hs.SuccessResponse(res)
	} else {

		// Convert fromTime and endTime from epoch seconds to date time format to seconds for the Unix() method
		from := c.Query("from")
		to := c.Query("to")

		const dbDateTimeFormat = "2006-01-02 15:04:05 -0700"

		// Not allowed to query for more than this number of days. This is also the default offset for fromTime if the param is missing
		const maxQueryableDays int64 = 30
		const maxQueryableDaysMilliSec int64 = maxQueryableDays * 24 * 60 * 60 * 1000

		// Grafana dashboard time variable is in milliseconds by default, so we are expecting that and converting to int before formatting to a postgres compatible format.
		var fromTimeInt, toTimeInt int64

		if to == "" {
			// default toTime when param is missing
			toTimeInt = time.Now().UnixMilli()
		} else {
			_temp, err := strconv.ParseInt(to, 10, 0)
			if err != nil {
				return hs.FailResponse(err)
			}
			toTimeInt = _temp
		}

		if from == "" {
			// default fromTime when param is missing
			fromTimeInt = toTimeInt - maxQueryableDaysMilliSec
		} else {
			_temp, err := strconv.ParseInt(from, 10, 0)
			if err != nil {
				return hs.FailResponse(err)
			}
			fromTimeInt = _temp
		}

		if (toTimeInt - fromTimeInt) > maxQueryableDaysMilliSec {
			hs.log.Warn(fmt.Sprintf("Changed fromTime to (toTime - %d days) since it was going beyond the allowed timeframe", maxQueryableDays))
			fromTimeInt = toTimeInt - maxQueryableDaysMilliSec
		}

		formattedFromTime := time.UnixMilli(fromTimeInt).Format(dbDateTimeFormat)
		formattedToTime := time.UnixMilli(toTimeInt).Format(dbDateTimeFormat)

		if strings.EqualFold(predefinedQuery, "schedule") {
			lastDayScheduleDetails := c.Query("lastDayDetails") == "true"
			allScheduleInfo := c.Query("allScheduleInfo") == "true"
			res, err := hs.usagedataService.GetDashboardsReportScheduler(c.Req.Context(), formattedFromTime, formattedToTime, c.OrgID, lastDayScheduleDetails, allScheduleInfo)
			if err != nil {
				return hs.FailResponse(err)
			}

			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "orgdashboardsstats") {
			res, err := hs.usagedataService.GetOrgLevelDashboardStats(c.Req.Context(), formattedFromTime, formattedToTime, c.OrgID)
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "dashboardhitcount") {

			dashboardID, err := GetIdFromStrId(c.Query("dashboardID"))
			if err != nil {
				return hs.FailResponse(err)
			}
			res, err := hs.usagedataService.GetDashboardHits(c.Req.Context(), formattedFromTime, formattedToTime, dashboardID, c.OrgID)
			if err != nil {
				return hs.FailResponse(err)
			}

			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "dashboardloadtime") {
			dashboardID, err := GetIdFromStrId(c.Query("dashboardID"))
			if err != nil {
				return hs.FailResponse(err)
			}
			res, err := hs.usagedataService.GetDashboardLoadTimes(c.Req.Context(), formattedFromTime, formattedToTime, dashboardID, c.OrgID)
			if err != nil {
				return hs.FailResponse(err)
			}

			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "dashboarduserhitcount") {
			user := c.Query("user")
			dashboard := c.Query("dashboard")
			res, err := hs.usagedataService.GetDashboardHitsUserInfo(c.Req.Context(), formattedFromTime, formattedToTime, c.OrgID, user, dashboard)
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "schedulerstaging") {
			scheduleName := c.Query("scheduleName")
			isDev := c.Query("includeError") == "true"
			res, err := hs.usagedataService.GetReportSchedulerStaging(c.Req.Context(), c.OrgID, scheduleName, formattedFromTime, formattedToTime, isDev)
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "nextschedules") {
			res, err := hs.usagedataService.GetNextRunSchedules(c.Req.Context(), c.OrgID)
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "valuerealization") {
			userIDStr := c.Query("userID")

			var (
				userID int64
				err    error
			)

			if userIDStr == "" {
				// optional param → default behavior
				userID = 0
			} else {
				userID, err = GetIdFromStrId(userIDStr)
				if err != nil {
					return hs.FailResponse(err)
				}
			}
			res, err := hs.usagedataService.GetIFValueRealization(c.Req.Context(), c.OrgID,userID, formattedFromTime, formattedToTime )
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		} else if strings.EqualFold(predefinedQuery, "ifdashboardcount") {
			userIDStr := c.Query("userID")

			var (
				userID int64
				err    error
			)

			if userIDStr == "" {
				// optional param → default behavior
				userID = 0
			} else {
				userID, err = GetIdFromStrId(userIDStr)
				if err != nil {
					return hs.FailResponse(err)
				}
			}
			res, err := hs.usagedataService.GetIFDashboardCount(c.Req.Context(), c.OrgID, userID, formattedFromTime, formattedToTime )
			if err != nil {
				return hs.FailResponse(err)
			}
			return hs.SuccessResponse(res)
		}
	}

	// Value not supported
	msg := predefinedQuery + " is not a valid value for the parameter predefinedQuery"
	hs.log.Error(msg)
	return hs.FailResponse(errors.New(msg))

}

func GetIdFromStrId(dashboardIDString string) (int64, error) {
	if dashboardIDString == "" {
		return 0, errors.New("ID must be provided to fetch individual dashboard stats")
	}
	_temp, err := strconv.ParseInt(dashboardIDString, 10, 0)
	if err != nil {
		return 0, err
	}
	return _temp, nil
}
