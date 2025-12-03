package conversion

import (
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// Conversion Data Loss Detection Strategy for Dashboard Conversions
//
// This module implements comprehensive data loss detection to identify when data is lost during
// dashboard conversions between different API versions (v0alpha1, v1beta1, v2alpha1, v2beta1).
//
// # What We Detect
//
// The data loss detection system checks that critical dashboard components are preserved:
//
// 1. **Panel Count**: Total number of visualization panels (including library panels)
//    - Counts regular panels and library panel references
//    - Excludes row panels (which are layout containers, not visualizations)
//    - Includes panels nested inside collapsed rows
//
// 2. **Query Count**: Total number of data source queries across all panels
//    - Each panel can have multiple queries (targets)
//    - Queries define what data is fetched and displayed
//    - Loss of queries means loss of data visualization
//
// 3. **Annotation Count**: Number of annotation configurations
//    - Annotations mark events and time ranges on visualizations
//    - Each annotation can query a datasource for events
//
// 4. **Dashboard Link Count**: Number of navigation links to other dashboards or URLs
//    - Links enable dashboard navigation workflows
//    - Important for dashboard ecosystems

// ConversionDataLossError represents data loss detected during dashboard conversion
type ConversionDataLossError struct {
	functionName     string
	message          string
	sourceAPIVersion string
	targetAPIVersion string
}

// NewConversionDataLossError creates a new ConversionDataLossError
func NewConversionDataLossError(functionName, message, sourceAPIVersion, targetAPIVersion string) *ConversionDataLossError {
	return &ConversionDataLossError{
		functionName:     functionName,
		message:          message,
		sourceAPIVersion: sourceAPIVersion,
		targetAPIVersion: targetAPIVersion,
	}
}

// Error implements the error interface
func (e *ConversionDataLossError) Error() string {
	return fmt.Sprintf("data loss detected in %s (%s → %s): %s", e.functionName, e.sourceAPIVersion, e.targetAPIVersion, e.message)
}

// GetFunctionName returns the function name where data loss was detected
func (e *ConversionDataLossError) GetFunctionName() string {
	return e.functionName
}

// GetSourceAPIVersion returns the source API version
func (e *ConversionDataLossError) GetSourceAPIVersion() string {
	return e.sourceAPIVersion
}

// GetTargetAPIVersion returns the target API version
func (e *ConversionDataLossError) GetTargetAPIVersion() string {
	return e.targetAPIVersion
}

// dashboardStats contains statistics about a dashboard for data loss detection
type dashboardStats struct {
	panelCount      int
	queryCount      int
	annotationCount int
	linkCount       int
	variableCount   int
}

// countPanelsV0V1 counts panels in v0alpha1 or v1beta1 dashboard spec (unstructured JSON)
func countPanelsV0V1(spec map[string]interface{}) int {
	if spec == nil {
		return 0
	}

	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return 0
	}

	count := 0
	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Count regular panels (excluding row panels)
		panelType, _ := panelMap["type"].(string)
		if panelType != "row" {
			count++
		}

		// Count collapsed panels inside row panels
		if panelType == "row" {
			if collapsedPanels, ok := panelMap["panels"].([]interface{}); ok {
				count += len(collapsedPanels)
			}
		}
	}

	return count
}

// countQueriesV0V1 counts data queries in v0alpha1 or v1beta1 dashboard spec
// Note: Row panels are layout containers and should not have queries.
// We ignore any queries on row panels themselves, but count queries in their collapsed panels.
func countQueriesV0V1(spec map[string]interface{}) int {
	if spec == nil {
		return 0
	}

	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return 0
	}

	count := 0
	for _, p := range panels {
		panelMap, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		panelType, _ := panelMap["type"].(string)

		// Count queries in regular panels (NOT row panels)
		if panelType != "row" {
			if targets, ok := panelMap["targets"].([]interface{}); ok {
				count += len(targets)
			}
		}

		// Count queries in collapsed panels inside row panels
		if panelType == "row" {
			if collapsedPanels, ok := panelMap["panels"].([]interface{}); ok {
				for _, cp := range collapsedPanels {
					if cpMap, ok := cp.(map[string]interface{}); ok {
						if targets, ok := cpMap["targets"].([]interface{}); ok {
							count += len(targets)
						}
					}
				}
			}
		}
	}

	return count
}

// countAnnotationsV0V1 counts annotations in v0alpha1 or v1beta1 dashboard spec
func countAnnotationsV0V1(spec map[string]interface{}) int {
	if spec == nil {
		return 0
	}

	annotations, ok := spec["annotations"].(map[string]interface{})
	if !ok {
		return 0
	}

	annotationList, ok := annotations["list"].([]interface{})
	if !ok {
		return 0
	}

	return len(annotationList)
}

// countLinksV0V1 counts dashboard links in v0alpha1 or v1beta1 dashboard spec
func countLinksV0V1(spec map[string]interface{}) int {
	if spec == nil {
		return 0
	}

	links, ok := spec["links"].([]interface{})
	if !ok {
		return 0
	}

	return len(links)
}

// countVariablesV0V1 counts template variables in v0alpha1 or v1beta1 dashboard spec
func countVariablesV0V1(spec map[string]interface{}) int {
	if spec == nil {
		return 0
	}

	templating, ok := spec["templating"].(map[string]interface{})
	if !ok {
		return 0
	}

	variableList, ok := templating["list"].([]interface{})
	if !ok {
		return 0
	}

	return len(variableList)
}

// collectStatsV0V1 collects statistics from v0alpha1 or v1beta1 dashboard
func collectStatsV0V1(spec map[string]interface{}) dashboardStats {
	return dashboardStats{
		panelCount:      countPanelsV0V1(spec),
		queryCount:      countQueriesV0V1(spec),
		annotationCount: countAnnotationsV0V1(spec),
		linkCount:       countLinksV0V1(spec),
		variableCount:   countVariablesV0V1(spec),
	}
}

// countPanelsV2 counts panels in v2alpha1 or v2beta1 dashboard spec (structured)
func countPanelsV2(elements map[string]dashv2alpha1.DashboardElement) int {
	count := 0
	for _, element := range elements {
		// Check if element is a Panel (not a LibraryPanel)
		if element.PanelKind != nil {
			count++
		} else if element.LibraryPanelKind != nil {
			count++
		}
	}
	return count
}

// countQueriesV2 counts data queries in v2alpha1 or v2beta1 dashboard spec
func countQueriesV2(elements map[string]dashv2alpha1.DashboardElement) int {
	count := 0
	for _, element := range elements {
		if element.PanelKind != nil {
			count += len(element.PanelKind.Spec.Data.Spec.Queries)
		}
	}
	return count
}

// countAnnotationsV2 counts annotations in v2alpha1 or v2beta1 dashboard spec
func countAnnotationsV2(annotations []dashv2alpha1.DashboardAnnotationQueryKind) int {
	return len(annotations)
}

// countLinksV2 counts dashboard links in v2alpha1 or v2beta1 dashboard spec
func countLinksV2(links []dashv2alpha1.DashboardDashboardLink) int {
	return len(links)
}

// countVariablesV2 counts template variables in v2alpha1 or v2beta1 dashboard spec
func countVariablesV2(variables []dashv2alpha1.DashboardVariableKind) int {
	return len(variables)
}

// collectStatsV2alpha1 collects statistics from v2alpha1 dashboard
func collectStatsV2alpha1(spec dashv2alpha1.DashboardSpec) dashboardStats {
	return dashboardStats{
		panelCount:      countPanelsV2(spec.Elements),
		queryCount:      countQueriesV2(spec.Elements),
		annotationCount: countAnnotationsV2(spec.Annotations),
		linkCount:       countLinksV2(spec.Links),
		variableCount:   countVariablesV2(spec.Variables),
	}
}

// countPanelsV2beta1 counts panels in v2beta1 dashboard spec
func countPanelsV2beta1(elements map[string]dashv2beta1.DashboardElement) int {
	count := 0
	for _, element := range elements {
		// Check if element is a Panel (not a LibraryPanel)
		if element.PanelKind != nil {
			count++
		} else if element.LibraryPanelKind != nil {
			count++
		}
	}
	return count
}

// countQueriesV2beta1 counts data queries in v2beta1 dashboard spec
func countQueriesV2beta1(elements map[string]dashv2beta1.DashboardElement) int {
	count := 0
	for _, element := range elements {
		if element.PanelKind != nil {
			count += len(element.PanelKind.Spec.Data.Spec.Queries)
		}
	}
	return count
}

// countAnnotationsV2beta1 counts annotations in v2beta1 dashboard spec
func countAnnotationsV2beta1(annotations []dashv2beta1.DashboardAnnotationQueryKind) int {
	return len(annotations)
}

// countLinksV2beta1 counts dashboard links in v2beta1 dashboard spec
func countLinksV2beta1(links []dashv2beta1.DashboardDashboardLink) int {
	return len(links)
}

// countVariablesV2beta1 counts template variables in v2beta1 dashboard spec
func countVariablesV2beta1(variables []dashv2beta1.DashboardVariableKind) int {
	return len(variables)
}

// collectStatsV2beta1 collects statistics from v2beta1 dashboard
func collectStatsV2beta1(spec dashv2beta1.DashboardSpec) dashboardStats {
	return dashboardStats{
		panelCount:      countPanelsV2beta1(spec.Elements),
		queryCount:      countQueriesV2beta1(spec.Elements),
		annotationCount: countAnnotationsV2beta1(spec.Annotations),
		linkCount:       countLinksV2beta1(spec.Links),
		variableCount:   countVariablesV2beta1(spec.Variables),
	}
}

// detectConversionDataLoss detects if critical dashboard data was lost during conversion
// Note: We only check for DATA LOSS (target < source), not additions (target > source).
// Conversions may add default values (like built-in annotations) which is expected behavior.
func detectConversionDataLoss(sourceStats, targetStats dashboardStats, sourceFuncName, targetFuncName string) error {
	var errors []string

	// Panel count: detect loss only (target < source)
	if targetStats.panelCount < sourceStats.panelCount {
		errors = append(errors, fmt.Sprintf(
			"panel count decreased: source=%d, target=%d (loss of %d panels)",
			sourceStats.panelCount,
			targetStats.panelCount,
			sourceStats.panelCount-targetStats.panelCount,
		))
	}

	// Query count: detect loss only (target < source)
	if targetStats.queryCount < sourceStats.queryCount {
		errors = append(errors, fmt.Sprintf(
			"query count decreased: source=%d, target=%d (loss of %d queries)",
			sourceStats.queryCount,
			targetStats.queryCount,
			sourceStats.queryCount-targetStats.queryCount,
		))
	}

	// Annotation count: detect loss only (target < source)
	// Note: Conversions may add default annotations, so additions are allowed
	if targetStats.annotationCount < sourceStats.annotationCount {
		errors = append(errors, fmt.Sprintf(
			"annotation count decreased: source=%d, target=%d (loss of %d annotations)",
			sourceStats.annotationCount,
			targetStats.annotationCount,
			sourceStats.annotationCount-targetStats.annotationCount,
		))
	}

	// Dashboard link count: detect loss only (target < source)
	if targetStats.linkCount < sourceStats.linkCount {
		errors = append(errors, fmt.Sprintf(
			"dashboard link count decreased: source=%d, target=%d (loss of %d links)",
			sourceStats.linkCount,
			targetStats.linkCount,
			sourceStats.linkCount-targetStats.linkCount,
		))
	}

	// Variable count: detect loss only (target < source)
	if targetStats.variableCount < sourceStats.variableCount {
		errors = append(errors, fmt.Sprintf(
			"variable count decreased: source=%d, target=%d (loss of %d variables)",
			sourceStats.variableCount,
			targetStats.variableCount,
			sourceStats.variableCount-targetStats.variableCount,
		))
	}

	if len(errors) > 0 {
		errorMsg := fmt.Sprintf("%v", errors)
		// Note: sourceAPIVersion and targetAPIVersion are passed from checkConversionDataLoss
		// For now, use empty strings - they will be set by the caller
		return NewConversionDataLossError(fmt.Sprintf("%s_to_%s", sourceFuncName, targetFuncName), errorMsg, "", "")
	}

	return nil
}

// checkConversionDataLoss is the data loss check function that can be passed to withConversionMetrics
// It collects statistics from source and target dashboards and detects if data was lost
// Returns a ConversionDataLossError if data loss is detected, nil otherwise
func checkConversionDataLoss(sourceVersionAPI, targetVersionAPI string, a, b interface{}) error {
	// Collect source statistics
	sourceStats := collectDashboardStats(a)

	// Collect target statistics
	targetStats := collectDashboardStats(b)

	// Detect if data was lost
	err := detectConversionDataLoss(sourceStats, targetStats, convertAPIVersionToFuncName(sourceVersionAPI), convertAPIVersionToFuncName(targetVersionAPI))

	// If data loss was detected, update the error with API versions
	if err != nil {
		var dataLossErr *ConversionDataLossError
		if errors.As(err, &dataLossErr) {
			dataLossErr.sourceAPIVersion = sourceVersionAPI
			dataLossErr.targetAPIVersion = targetVersionAPI
		}
	}

	return err
}

// collectDashboardStats collects statistics from a dashboard object (any version)
func collectDashboardStats(dashboard interface{}) dashboardStats {
	switch d := dashboard.(type) {
	case *dashv0.Dashboard:
		if d.Spec.Object != nil {
			return collectStatsV0V1(d.Spec.Object)
		}
	case *dashv1.Dashboard:
		if d.Spec.Object != nil {
			return collectStatsV0V1(d.Spec.Object)
		}
	case *dashv2alpha1.Dashboard:
		return collectStatsV2alpha1(d.Spec)
	case *dashv2beta1.Dashboard:
		return collectStatsV2beta1(d.Spec)
	}
	return dashboardStats{}
}

// withConversionDataLossDetection wraps a conversion function to detect data loss
func withConversionDataLossDetection(sourceFuncName, targetFuncName string, conversionFunc func(a, b interface{}, scope conversion.Scope) error) func(a, b interface{}, scope conversion.Scope) error {
	return func(a, b interface{}, scope conversion.Scope) error {
		// Collect source statistics
		var sourceStats dashboardStats
		switch source := a.(type) {
		case *dashv0.Dashboard:
			if source.Spec.Object != nil {
				sourceStats = collectStatsV0V1(source.Spec.Object)
			}
		case *dashv1.Dashboard:
			if source.Spec.Object != nil {
				sourceStats = collectStatsV0V1(source.Spec.Object)
			}
		case *dashv2alpha1.Dashboard:
			sourceStats = collectStatsV2alpha1(source.Spec)
		case *dashv2beta1.Dashboard:
			sourceStats = collectStatsV2beta1(source.Spec)
		}

		// Execute the conversion
		err := conversionFunc(a, b, scope)
		if err != nil {
			return err
		}

		// Collect target statistics
		var targetStats dashboardStats
		switch target := b.(type) {
		case *dashv0.Dashboard:
			if target.Spec.Object != nil {
				targetStats = collectStatsV0V1(target.Spec.Object)
			}
		case *dashv1.Dashboard:
			if target.Spec.Object != nil {
				targetStats = collectStatsV0V1(target.Spec.Object)
			}
		case *dashv2alpha1.Dashboard:
			targetStats = collectStatsV2alpha1(target.Spec)
		case *dashv2beta1.Dashboard:
			targetStats = collectStatsV2beta1(target.Spec)
		}

		// Detect if data was lost
		if dataLossErr := detectConversionDataLoss(sourceStats, targetStats, sourceFuncName, targetFuncName); dataLossErr != nil {
			logger.Error("Dashboard conversion data loss detected",
				"sourceFunc", sourceFuncName,
				"targetFunc", targetFuncName,
				"sourcePanels", sourceStats.panelCount,
				"targetPanels", targetStats.panelCount,
				"sourceQueries", sourceStats.queryCount,
				"targetQueries", targetStats.queryCount,
				"sourceAnnotations", sourceStats.annotationCount,
				"targetAnnotations", targetStats.annotationCount,
				"sourceLinks", sourceStats.linkCount,
				"targetLinks", targetStats.linkCount,
				"error", dataLossErr,
			)
			return dataLossErr
		}

		logger.Debug("Dashboard conversion completed without data loss",
			"sourceFunc", sourceFuncName,
			"targetFunc", targetFuncName,
			"panels", targetStats.panelCount,
			"queries", targetStats.queryCount,
			"annotations", targetStats.annotationCount,
			"links", targetStats.linkCount,
		)

		return nil
	}
}
