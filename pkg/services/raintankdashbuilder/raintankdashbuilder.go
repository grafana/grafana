package raintankdashbuilder

import (
	"fmt"
        "encoding/json"
        "strings"
	
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	m "github.com/grafana/grafana/pkg/models"
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
		SiteId: event.Id,
		AccountId: event.AccountId,
		Title:     fmt.Sprintf("%s Site Summary", event.Name),
		Tags:      fmt.Sprintf("[\"%s\"]", event.Name),
	})
	
	if err != nil {
		fmt.Println("failed to get new dashboard for site")
		return err
	}

	msgString, err := json.Marshal(siteSummary)
        fmt.Println(string(msgString))

	cmd := m.SaveDashboardCommand{
		Dashboard: siteSummary,
		AccountId: event.AccountId,
	}
	return SaveDashboard(&cmd)
}

func SaveDashboard(cmd *m.SaveDashboardCommand) error {
	err := bus.Dispatch(cmd)
        if err != nil {
		fmt.Println(err)
                if err == m.ErrDashboardWithSameNameExists {
			//maybe we should change the name and try again.
                        return err
                }
                return err
        }
        return nil
}

func SiteUpdated(event *events.SiteUpdated) error {
	fmt.Printf("Site %d updated by account %d, need to update dashboards\n", event.Id, event.AccountId)
	title := fmt.Sprintf("%s Site Summary", event.Name)
	slug := DashboardSlug(title)

	query := m.GetDashboardQuery{Slug: slug, AccountId: event.AccountId}
	err := bus.Dispatch(&query)
	if err != nil {
		if err != m.ErrDashboardNotFound {
			return err
		}
	}
	tags := make([]string, 0)
	for _, t := range query.Result.GetTags() {
		tags = append(tags, fmt.Sprintf("\"%s\"", t))
	}
	siteSummary, err := SiteSummary(&SiteSummaryData{
                SiteId:    event.Id,
		DashId:    query.Result.Id,
                AccountId: event.AccountId,
                Title:     title,
		Tags:      fmt.Sprintf("[%s]", strings.Join(tags, ",")),
        })
        if err != nil {
                fmt.Println("failed to get new dashboard for site")
                return err
        }

        msgString, err := json.Marshal(siteSummary)
        fmt.Println(string(msgString))

        cmd := m.SaveDashboardCommand{
                Dashboard: siteSummary,
                AccountId: event.AccountId,
        }
        return SaveDashboard(&cmd)

}

func SiteRemoved(event *events.SiteRemoved) error {

	fmt.Printf("Site %d removed by account %d, need to delete dashboards\n", event.Id, event.AccountId)
	return nil
}

func MonitorCreated(event *events.MonitorCreated) error {

	fmt.Printf("Monitor %s created by account %d, need to create dashboards\n", event.Name, event.AccountId)
	return nil
}

func MonitorUpdated(event *events.MonitorUpdated) error {
	fmt.Printf("Monitor %s updated by account %d, need to update dashboards\n", event.Name, event.AccountId)
	
	return nil
}

func MonitorRemoved(event *events.MonitorRemoved) error {

	fmt.Printf("Monitor %d removed by account %d, need to remove dashboards\n", event.Id, event.AccountId)
	return nil
}

