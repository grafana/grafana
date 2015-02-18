package raintankdashbuilder

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
)

var (
	MonitorTypeIdToNameMap = make(map[int64]string)
)

func init() {
	bus.AddEventListener(SiteCreated)
	bus.AddEventListener(SiteUpdated)
	bus.AddEventListener(SiteRemoved)
	bus.AddEventListener(MonitorCreated)
	bus.AddEventListener(MonitorUpdated)
	bus.AddEventListener(MonitorRemoved)
}

func SiteCreated(event *events.SiteCreated) error {
	fmt.Printf("Site %s created by account %d, need to create dashboards\n", event.Name, event.AccountId)
	siteSummary, err := SiteSummary(&SiteSummaryData{
		SiteId:    event.Id,
		AccountId: event.AccountId,
		Title:     fmt.Sprintf("%s Site Summary", event.Name),
		Tags:      fmt.Sprintf("[\"%s\"]", event.Name),
	})

	if err != nil {
		fmt.Println("failed to get new dashboard for site")
		return err
	}

	cmd := m.SaveDashboardCommand{
		Dashboard: siteSummary,
		AccountId: event.AccountId,
	}
	return SaveDashboard(&cmd)
}

func SaveDashboard(cmd *m.SaveDashboardCommand) error {
	err := bus.Dispatch(cmd)
	if err != nil {
		return err
	}
	return nil
}

func SiteUpdated(event *events.SiteUpdated) error {
	fmt.Printf("Site %d updated by account %d, need to update dashboards\n", event.Id, event.AccountId)
	monQuery := m.GetMonitorsQuery{
		SiteId:    []int64{event.Id},
		AccountId: event.AccountId,
	}
	if err := bus.Dispatch(&monQuery); err != nil {
		return err
	}
	monitors := monQuery.Result
	//check if the site name has changed
	var oldTags []string
	var oldName string
	if event.LastState.Name != event.Name {
		oldName = event.LastState.Name
		oldTitle := fmt.Sprintf("%s Site Summary", event.LastState.Name)
		oldSlug := DashboardSlug(oldTitle)
		query := m.GetDashboardQuery{Slug: oldSlug, AccountId: event.AccountId}
		err := bus.Dispatch(&query)
		if err != nil {
			if err != m.ErrDashboardNotFound {
				return err
			}
		} else {
			oldTags = query.Result.GetTags()
			cmd := m.DeleteDashboardCommand{Slug: oldSlug, AccountId: event.AccountId}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
		}
		for _, mon := range monitors {
			//we need to update all of the tags for each of the monitorDashboards`
			title := fmt.Sprintf("%s Monitor Summary", mon.Name)
			slug := DashboardSlug(title)
			query = m.GetDashboardQuery{Slug: slug, AccountId: event.AccountId}
			err := bus.Dispatch(&query)
			if err != nil {
				if err != m.ErrDashboardNotFound {
					return err
				}
			} else {
				dash := query.Result
				currentTags := dash.GetTags()
				newTags := make([]string, 0)
				for _, t := range currentTags {
					if t == oldName {
						newTags = append(newTags, event.Name)
					} else {
						newTags = append(newTags, t)
					}
				}
				dash.Data["tags"] = newTags
				//there is no way to save a m.Dashboard object.
				// Instead we need to convert to json, then convert
				// the json to a map[string]interface{}

				var dashboard map[string]interface{}
				dashboardJson, err := json.Marshal(dash.Data)
				if err != nil {
					return err
				}
				err = json.Unmarshal(dashboardJson, &dashboard)
				if err != nil {
					return err
				}

				cmd := m.SaveDashboardCommand{
					Dashboard: dashboard,
					AccountId: event.AccountId,
				}
				err = SaveDashboard(&cmd)
				if err != nil {
					return err
				}
			}

		}
	}

	title := fmt.Sprintf("%s Site Summary", event.Name)
	slug := DashboardSlug(title)

	query := m.GetDashboardQuery{Slug: slug, AccountId: event.AccountId}
	err := bus.Dispatch(&query)
	if err != nil {
		if err == m.ErrDashboardNotFound {
			query.Result = &m.Dashboard{}
		} else {
			return err
		}
	}
	tags := make([]string, 0)
	if query.Result.Id > 0 {
		for _, t := range query.Result.GetTags() {
			tags = append(tags, fmt.Sprintf("\"%s\"", t))
		}
	} else {
		if len(oldTags) > 0 {
			for _, t := range oldTags {
				if t != oldName {
					tags = append(tags, fmt.Sprintf("\"%s\"", t))
				}
			}
		} else {
			tags = append(tags, fmt.Sprintf("\"%s\"", event.Name))
		}
	}
	tagMap := make(map[string]bool)
	for _, t := range tags {
		tagMap[t] = true
	}
	requiredTags := []string{fmt.Sprintf("\"%s\"", event.Name)}
	for _, t := range requiredTags {
		_, ok := tagMap[t]
		if !ok {
			tags = append(tags, t)
		}
	}
	siteSummary, err := SiteSummary(&SiteSummaryData{
		SiteId:    event.Id,
		DashId:    query.Result.Id,
		AccountId: event.AccountId,
		Title:     title,
		Tags:      fmt.Sprintf("[%s]", strings.Join(tags, ",")),
		Monitors:  monitors,
	})
	if err != nil {
		fmt.Println("failed to get new dashboard for site")
		return err
	}

	cmd := m.SaveDashboardCommand{
		Dashboard: siteSummary,
		AccountId: event.AccountId,
	}
	return SaveDashboard(&cmd)

}

func SiteRemoved(event *events.SiteRemoved) error {
	fmt.Printf("Site %s removed by account %d, need to delete dashboards\n", event.Name, event.AccountId)
	title := fmt.Sprintf("%s Site Summary", event.Name)
	slug := DashboardSlug(title)
	cmd := m.DeleteDashboardCommand{Slug: slug, AccountId: event.AccountId}
	return bus.Dispatch(&cmd)
}

func updateSite(id int64, accountId int64) error {
	query := m.GetSiteByIdQuery{Id: id, AccountId: accountId}
	err := bus.Dispatch(&query)
	if err != nil {
		return err
	}
	e := events.SiteUpdated{
		SitePayload: events.SitePayload{
			Id:        query.Result.Id,
			AccountId: query.Result.AccountId,
			Name:      query.Result.Name,
			Slug:      query.Result.Slug,
		},
		LastState: &events.SitePayload{
			Id:        query.Result.Id,
			AccountId: query.Result.AccountId,
			Name:      query.Result.Name,
			Slug:      query.Result.Slug,
		},
	}
	return SiteUpdated(&e)
}

func getSiteName(id int64, accountId int64) (string, error) {
	query := m.GetSiteByIdQuery{Id: id, AccountId: accountId}
	err := bus.Dispatch(&query)
	if err != nil {
		return "", err
	}
	return query.Result.Name, nil
}

func getMonitorTypeName(id int64) (string, error) {
	v, ok := MonitorTypeIdToNameMap[id]
	if !ok {
		query := m.GetMonitorTypesQuery{}
		err := bus.Dispatch(&query)
		if err != nil {
			return "", err
		}
		found := false
		for _, mt := range query.Result {
			if mt.Id == id {
				found = true
				v = mt.Name
			}
			MonitorTypeIdToNameMap[mt.Id] = mt.Name
		}
		if !found {
			return "", errors.New("monitorType not found")
		}
	}
	return v, nil
}

func MonitorCreated(event *events.MonitorCreated) error {
	fmt.Printf("Monitor %s created by account %d, need to create dashboards\n", event.Name, event.AccountId)
	//need to update the siteDashboard
	if err := updateSite(event.SiteId, event.AccountId); err != nil {
		return err
	}
	siteName, err := getSiteName(event.SiteId, event.AccountId)
	if err != nil {
		return err
	}
	monitorTypeName, err := getMonitorTypeName(event.MonitorTypeId)
	if err != nil {
		return err
	}
	//create MonitorSummaryDashboard
	monitorSummary, err := MonitorSummary(&MonitorSummaryData{
		SiteId:    event.SiteId,
		AccountId: event.AccountId,
		Slug:      event.Slug,
		Title:     fmt.Sprintf("%s Monitor Summary", event.Name),
		Tags:      fmt.Sprintf("[\"%s\", \"%s\"]", siteName, monitorTypeName),
		Namespace: event.Namespace,
		Protocol:  strings.ToLower(monitorTypeName),
	})
	if err != nil {
		fmt.Println("failed to get new dashboard for monitor")
		return err
	}

	cmd := m.SaveDashboardCommand{
		Dashboard: monitorSummary,
		AccountId: event.AccountId,
	}
	if err = SaveDashboard(&cmd); err != nil {
		return err
	}
	//create monitorDetailDashboard

	return nil
}

func MonitorUpdated(event *events.MonitorUpdated) error {
	fmt.Printf("Monitor %s updated by account %d, need to update dashboards\n", event.Name, event.AccountId)
	siteName, err := getSiteName(event.SiteId, event.AccountId)
	if err != nil {
		return err
	}
	oldSiteName := ""
	if event.LastState.SiteId != event.SiteId {
		oldSiteName, err = getSiteName(event.LastState.SiteId, event.AccountId)
		if err != nil {
			return err
		}
	}
	monitorTypeName, err := getMonitorTypeName(event.MonitorTypeId)
	if err != nil {
		return err
	}

	//update the site summary dashboard
	if event.LastState.SiteId != event.SiteId {
		err := updateSite(event.LastState.SiteId, event.AccountId)
		if err != nil {
			return err
		}
	}

	if err := updateSite(event.SiteId, event.AccountId); err != nil {
		return err
	}

	//update monitorSummaryDashboard
	//check if the monitor name has changed
	oldTags := make([]string, 0)
	if event.LastState.Name != event.Name {
		oldTitle := fmt.Sprintf("%s Monitor Summary", event.LastState.Name)
		oldSlug := DashboardSlug(oldTitle)
		query := m.GetDashboardQuery{Slug: oldSlug, AccountId: event.AccountId}
		err := bus.Dispatch(&query)
		if err != nil {
			if err != m.ErrDashboardNotFound {
				return err
			}
		} else {
			oldTags = query.Result.GetTags()
			cmd := m.DeleteDashboardCommand{Slug: oldSlug, AccountId: event.AccountId}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
		}
	}

	title := fmt.Sprintf("%s Monitor Summary", event.Name)
	slug := DashboardSlug(title)

	query := m.GetDashboardQuery{Slug: slug, AccountId: event.AccountId}
	err = bus.Dispatch(&query)
	if err != nil {
		if err == m.ErrDashboardNotFound {
			query.Result = &m.Dashboard{}
		} else {
			return err
		}
	}
	tags := make([]string, 0)
	if query.Result.Id > 0 {
		tags = query.Result.GetTags()
	} else {
		if len(oldTags) > 0 {
			tags = oldTags
		}
	}

	requiredTags := []string{siteName, monitorTypeName}
	tagMap := make(map[string]bool)
	for _, t := range tags {
		// If the siteName has changed, dont copy accross
		// the tag for the old site.
		if t != oldSiteName {
			tagMap[fmt.Sprintf("\"%s\"", t)] = true
		}
	}
	for _, t := range requiredTags {
		tagMap[fmt.Sprintf("\"%s\"", t)] = true
	}
	tagList := make([]string, 0)
	for k, _ := range tagMap {
		tagList = append(tagList, k)
	}
	tagStr := fmt.Sprintf("[%s]", strings.Join(tagList, ","))

	//create MonitorSummaryDashboard
	monitorSummary, err := MonitorSummary(&MonitorSummaryData{
		DashId:    query.Result.Id,
		SiteId:    event.SiteId,
		AccountId: event.AccountId,
		Slug:      event.Slug,
		Title:     fmt.Sprintf("%s Monitor Summary", event.Name),
		Tags:      tagStr,
		Namespace: event.Namespace,
		Protocol:  strings.ToLower(monitorTypeName),
	})
	if err != nil {
		fmt.Println("failed to get new dashboard for monitor")
		return err
	}

	cmd := m.SaveDashboardCommand{
		Dashboard: monitorSummary,
		AccountId: event.AccountId,
	}
	if err = SaveDashboard(&cmd); err != nil {
		return err
	}

	//update monitorDetailDashboard
	return nil
}

func MonitorRemoved(event *events.MonitorRemoved) error {
	fmt.Printf("Monitor %d removed by account %d, need to remove dashboards\n", event.Id, event.AccountId)
	if err := updateSite(event.SiteId, event.AccountId); err != nil {
		return err
	}

	//remove monitorSummaryDashboard
	title := fmt.Sprintf("%s Monitor Summary", event.Name)
	slug := DashboardSlug(title)
	cmd := m.DeleteDashboardCommand{Slug: slug, AccountId: event.AccountId}
	if err := bus.Dispatch(&cmd); err != nil {
		return err
	}

	//remove monitorDetailDashboard
	return nil
}
