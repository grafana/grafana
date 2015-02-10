package raintankdashbuilder

import (
	"fmt"
        "encoding/json"
	
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"	
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
	return nil
}

func SiteUpdated(event *events.SiteUpdated) error {

	fmt.Printf("Site %s updated by account %d, need to update dashboards\n", event.Name, event.AccountId)
	return nil

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
	wireEvent, err := events.ToOnWriteEvent(event)
        if err != nil {
                return err
        }

        msgString, err := json.Marshal(wireEvent)
	fmt.Println(string(msgString))
	fmt.Printf("Monitor %s updated by account %d, need to update dashboards\n", event.Name, event.AccountId)
	return nil
}

func MonitorRemoved(event *events.MonitorRemoved) error {

	fmt.Printf("Monitor %d removed by account %d, need to remove dashboards\n", event.Id, event.AccountId)
	return nil
}

