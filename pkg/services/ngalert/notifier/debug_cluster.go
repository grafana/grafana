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
