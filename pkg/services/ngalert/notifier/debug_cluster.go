package notifier

import (
	"fmt"
	"reflect"
	"runtime"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

// DebugClusterFlow helps understand how alerts flow through the alertmanager cluster
// by inspecting the alerting package and logging key information.
func DebugClusterFlow(logger log.Logger) {
	logger.Info("Analyzing alertmanager cluster flow")
	
	// The key components we want to inspect are in the github.com/grafana/alerting package
	// Specifically:
	// - github.com/grafana/alerting/notify/cluster_peer.go - implements the ClusterPeer interface
	// - github.com/grafana/alerting/notify/alertmanager.go - implements the alertmanager
	
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "The entry point for gossiped alerts is in the external github.com/grafana/alerting package")
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "When alerts are gossiped between instances, they are received through the ClusterPeer interface")
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "The ClusterPeer interface has methods like AddState() which creates a channel for state updates")
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "When the GrafanaAlertmanager is created, it registers with the ClusterPeer to receive updates")
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "When alerts are received from peers, they are processed by the alertmanager's internal alert provider")
	logger.Info("Alertmanager cluster flow analysis", 
		"message", "The flow is: peer receives message -> unmarshals to alerts -> calls provider.PutAlerts()")
	
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "1. In github.com/grafana/alerting/notify/alertmanager.go, the GrafanaAlertmanager constructor registers with the ClusterPeer")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "2. It calls peer.AddState('alerts', am.alerts, registry) to create a channel for alert updates")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "3. The alerts state is managed by the alertProvider in github.com/grafana/alerting/notify/alert_provider.go")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "4. When a peer receives a message, it's handled in github.com/grafana/alerting/cluster/channel.go")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "5. The message is unmarshaled and the state is updated via the channel's callback")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "6. For alerts, this callback is in github.com/grafana/alerting/notify/alert_provider.go:merge()")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "7. The merge() function calls provider.PutAlerts() to add the alerts to the local state")
	logger.Info("Detailed alertmanager cluster flow", 
		"message", "8. This is how alerts gossiped from other instances are added to the local alertmanager")
}

// MonitorAlertFlow sets up a goroutine to monitor alert flow in the alertmanager
func MonitorAlertFlow(am *alertmanager, logger log.Logger) {
	if am == nil || am.Base == nil {
		logger.Error("Cannot monitor alert flow for nil alertmanager")
		return
	}
	
	logger.Info("Setting up alert flow monitoring for alertmanager", "orgID", am.orgID)
	
	// This is a workaround to monitor alert flow since we can't directly hook into the alertmanager's internal alert provider
	// In a production environment, you might want to implement a more robust solution
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		
		for range ticker.C {
			// Use reflection to inspect the Base field (GrafanaAlertmanager)
			baseValue := reflect.ValueOf(am.Base).Elem()
			
			// Try to find the alerts field which contains the alertProvider
			alertsField := baseValue.FieldByName("alerts")
			if !alertsField.IsValid() {
				continue
			}
			
			// If we found the alerts field, try to get its length
			if alertsField.Kind() == reflect.Ptr && !alertsField.IsNil() {
				alertsValue := alertsField.Elem()
				
				// Try to find the alerts map inside the alertProvider
				alertsMapField := alertsValue.FieldByName("alerts")
				if alertsMapField.IsValid() && alertsMapField.Kind() == reflect.Map {
					logger.Info("Current alerts in alertmanager", 
						"orgID", am.orgID, 
						"count", alertsMapField.Len())
				}
			}
		}
	}()
}

// InspectAlertmanager logs information about the alertmanager's internal structure
func InspectAlertmanager(am *alertmanager, logger log.Logger) {
	if am == nil || am.Base == nil {
		logger.Error("Cannot inspect nil alertmanager")
		return
	}
	
	logger.Info("Inspecting alertmanager instance", "orgID", am.orgID)
	
	// Use reflection to inspect the Base field (GrafanaAlertmanager)
	baseValue := reflect.ValueOf(am.Base).Elem()
	baseType := baseValue.Type()
	
	logger.Info("Alertmanager base type", "type", baseType.String())
	
	// Log field names to help understand the structure
	for i := 0; i < baseValue.NumField(); i++ {
		field := baseType.Field(i)
		fieldValue := baseValue.Field(i)
		
		// Skip unexported fields
		if !field.IsExported() {
			continue
		}
		
		fieldType := field.Type.String()
		logger.Info("Alertmanager field", 
			"name", field.Name, 
			"type", fieldType,
			"isNil", fieldValue.IsNil() && (fieldValue.Kind() == reflect.Ptr || 
				fieldValue.Kind() == reflect.Interface || 
				fieldValue.Kind() == reflect.Slice || 
				fieldValue.Kind() == reflect.Map || 
				fieldValue.Kind() == reflect.Chan || 
				fieldValue.Kind() == reflect.Func))
	}
	
	logger.Info("Alertmanager inspection complete")
}
