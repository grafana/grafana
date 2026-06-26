package pluginscoring

import "time"

const (
	DimensionSafety    = "safety"
	DimensionQuality   = "quality"
	DimensionCommunity = "community"

	scoreLevelExcellent = "Excellent"
	scoreLevelGood      = "Good"
	scoreLevelFair      = "Fair"
	scoreLevelPoor      = "Poor"
	scoreLevelCritical  = "Critical"

	itemLevelWarning = "warning"

	cweBaseURL = "https://cwe.mitre.org/data/definitions/"
	noInfoID   = "NVD-CWE-noinfo"
	noInfoURL  = "https://nvd.nist.gov/vuln/categories#cweIdEntry-NVD-CWE-noinfo"
)

// ScorecardConditionType identifies the type of scorecard condition (KRM metav1.Condition-compatible).
type ScorecardConditionType = string

const (
	ScorecardConditionReady ScorecardConditionType = "Ready"
)

// ScorecardConditionStatus follows the k8s metav1.Condition status values.
type ScorecardConditionStatus = string

const (
	ScorecardConditionTrue    ScorecardConditionStatus = "True"
	ScorecardConditionFalse   ScorecardConditionStatus = "False"
	ScorecardConditionUnknown ScorecardConditionStatus = "Unknown"
)

// ScorecardConditionReason is a CamelCase reason for the condition state (KRM convention).
type ScorecardConditionReason = string

const (
	ScorecardReasonScanning    ScorecardConditionReason = "ScorecardScanning"
	ScorecardReasonScanned     ScorecardConditionReason = "ScorecardScanned"
	ScorecardReasonUnavailable ScorecardConditionReason = "ScorecardUnavailable"
)

// ScorecardCondition follows the Kubernetes metav1.Condition schema (KRM convention).
type ScorecardCondition struct {
	Type               ScorecardConditionType   `json:"type"`
	Status             ScorecardConditionStatus `json:"status"`
	Reason             ScorecardConditionReason `json:"reason"`
	LastTransitionTime string                   `json:"lastTransitionTime"`
}

// CatalogPluginInsights mirrors the existing frontend CatalogPluginInsights type,
// allowing our scorecard data to be rendered by the existing PluginInsights component
// without any frontend changes.
// The conditions field follows the KRM conditions convention, allowing clients to
// determine scorecard availability without polling.
type CatalogPluginInsights struct {
	ID         int                  `json:"id"`
	Name       string               `json:"name"`
	Version    string               `json:"version"`
	Insights   []InsightCategory    `json:"insights"`
	Conditions []ScorecardCondition `json:"conditions,omitempty"`
}

// InsightCategory mirrors the frontend InsightCategory type.
type InsightCategory struct {
	Name       string        `json:"name"`
	Items      []InsightItem `json:"items"`
	ScoreValue float64       `json:"scoreValue"`
	ScoreLevel string        `json:"scoreLevel"`
}

// InsightItem mirrors the frontend InsightItem type.
type InsightItem struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Level string `json:"level"`
	Link  string `json:"link,omitempty"`
}

// ScorecardResult mirrors the raw OpenSSF Scorecard API response.
type ScorecardResult struct {
	Score    float64          `json:"score"`
	Date     string           `json:"date"`
	Checks   []ScorecardCheck `json:"checks"`
	ScoredAt time.Time        `json:"scored_at"`
}

// ScorecardCheck is a single OpenSSF Scorecard check result.
type ScorecardCheck struct {
	Name   string `json:"name"`
	Score  int    `json:"score"`
	Reason string `json:"reason"`
}

// checkMapping maps a Scorecard check name to a CWE ID, display name, and dimension.
type checkMapping struct {
	cwe         string
	displayName string
	dimension   string
}

// scorecardChecks is the authoritative mapping of Scorecard check names to
// CWE IDs and scoring dimensions. Derived from the actual checks returned by
// api.securityscorecards.dev — only map checks confirmed to exist in the API.
// Add new Scorecard checks here as they appear.
var scorecardChecks = map[string]checkMapping{
	// Safety — supply chain and code execution risk
	"Binary-Artifacts":    {cwe: "CWE-506", displayName: "Binary-Artifacts", dimension: DimensionSafety},
	"Dangerous-Workflow":  {cwe: "CWE-94", displayName: "Dangerous-Workflow", dimension: DimensionSafety},
	"Token-Permissions":   {cwe: "CWE-732", displayName: "Token-Permissions", dimension: DimensionSafety},
	"Pinned-Dependencies": {cwe: "CWE-829", displayName: "Pinned-Dependencies", dimension: DimensionSafety},
	"Signed-Releases":     {cwe: "CWE-347", displayName: "Signed-Releases", dimension: DimensionSafety},
	"Vulnerabilities":     {cwe: "CWE-1329", displayName: "Vulnerabilities", dimension: DimensionSafety},

	// Quality — development practices
	"Code-Review":        {cwe: "CWE-1357", displayName: "Code-Review", dimension: DimensionQuality},
	"Branch-Protection":  {cwe: "CWE-1026", displayName: "Branch-Protection", dimension: DimensionQuality},
	"SAST":               {cwe: "CWE-358", displayName: "SAST", dimension: DimensionQuality},
	"Fuzzing":            {cwe: "CWE-1164", displayName: "Fuzzing", dimension: DimensionQuality},
	"Security-Policy":    {cwe: "CWE-693", displayName: "Security-Policy", dimension: DimensionQuality},
	"CII-Best-Practices": {cwe: "CWE-1059", displayName: "CII-Best-Practices", dimension: DimensionQuality},
	"License":            {cwe: "CWE-1076", displayName: "License", dimension: DimensionQuality},
	"Packaging":          {cwe: "CWE-1059", displayName: "Packaging", dimension: DimensionQuality},

	// Community — maintenance health and adoption signals
	"Maintained": {cwe: "CWE-1104", displayName: "Maintained", dimension: DimensionCommunity},
}

// ScorecardReadyCondition builds a KRM-style Ready condition for a plugin scorecard response.
func ScorecardReadyCondition(status ScorecardConditionStatus, reason ScorecardConditionReason) ScorecardCondition {
	return ScorecardCondition{
		Type:               ScorecardConditionReady,
		Status:             status,
		Reason:             reason,
		LastTransitionTime: time.Now().UTC().Format(time.RFC3339),
	}
}

// PendingInsights returns a CatalogPluginInsights with a ScorecardScanning condition.
// Clients should re-fetch after a short delay (scan in progress).
func PendingInsights(pluginID, version string) CatalogPluginInsights {
	return CatalogPluginInsights{
		Name:     pluginID,
		Version:  version,
		Insights: []InsightCategory{},
		Conditions: []ScorecardCondition{
			ScorecardReadyCondition(ScorecardConditionFalse, ScorecardReasonScanning),
		},
	}
}

// UnavailableInsights returns a CatalogPluginInsights with a ScorecardUnavailable condition.
func UnavailableInsights(pluginID, version string) CatalogPluginInsights {
	return CatalogPluginInsights{
		Name:     pluginID,
		Version:  version,
		Insights: []InsightCategory{},
		Conditions: []ScorecardCondition{
			ScorecardReadyCondition(ScorecardConditionFalse, ScorecardReasonUnavailable),
		},
	}
}

// FromScorecard maps a raw ScorecardResult into the CatalogPluginInsights shape
// so the existing PluginInsights frontend component can render it without changes.
// Returns UnavailableInsights if the result has no checks (empty/invalid scan).
func FromScorecard(pluginID, version string, r *ScorecardResult) CatalogPluginInsights {
	if len(r.Checks) == 0 {
		return UnavailableInsights(pluginID, version)
	}
	items := map[string][]InsightItem{
		DimensionSafety:    {},
		DimensionQuality:   {},
		DimensionCommunity: {},
	}
	totals := map[string]int{}
	counts := map[string]int{}

	for _, c := range r.Checks {
		m, ok := scorecardChecks[c.Name]
		if !ok {
			m = checkMapping{cwe: noInfoID, displayName: c.Name, dimension: DimensionQuality}
		}

		if c.Score >= 0 {
			totals[m.dimension] += c.Score
			counts[m.dimension]++
		}

		if c.Score >= 10 {
			continue
		}

		items[m.dimension] = append(items[m.dimension], InsightItem{
			ID:    m.cwe,
			Name:  m.displayName,
			Level: itemLevelWarning,
			Link:  cweRef(m.cwe),
		})
	}

	categories := []InsightCategory{
		buildCategory(DimensionSafety, items, totals, counts),
		buildCategory(DimensionQuality, items, totals, counts),
		buildCategory(DimensionCommunity, items, totals, counts),
	}

	return CatalogPluginInsights{
		Name:     pluginID,
		Version:  version,
		Insights: categories,
		Conditions: []ScorecardCondition{
			ScorecardReadyCondition(ScorecardConditionTrue, ScorecardReasonScanned),
		},
	}
}

func buildCategory(dim string, items map[string][]InsightItem, totals, counts map[string]int) InsightCategory {
	scoreValue := avgScoreValue(totals, counts, dim)
	return InsightCategory{
		Name:       dim,
		Items:      items[dim],
		ScoreValue: scoreValue,
		ScoreLevel: scoreLevelFromValue(scoreValue),
	}
}

func avgScoreValue(totals, counts map[string]int, dim string) float64 {
	if counts[dim] == 0 {
		return 100.0
	}
	return float64(totals[dim]) / float64(counts[dim]) * 10.0
}

func scoreLevelFromValue(v float64) string {
	switch {
	case v >= 85:
		return scoreLevelExcellent
	case v >= 65:
		return scoreLevelGood
	case v >= 45:
		return scoreLevelFair
	case v >= 25:
		return scoreLevelPoor
	default:
		return scoreLevelCritical
	}
}

func cweRef(cwe string) string {
	if cwe == noInfoID {
		return noInfoURL
	}
	for i, ch := range cwe {
		if ch == '-' {
			return cweBaseURL + cwe[i+1:] + ".html"
		}
	}
	return ""
}
