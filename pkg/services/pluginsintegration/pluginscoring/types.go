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

// GosecResult mirrors the top-level gosec JSON output.
type GosecResult struct {
	Issues []GosecIssue `json:"Issues"`
}

// GosecIssue mirrors a single gosec finding.
type GosecIssue struct {
	RuleID     string `json:"rule_id"`
	Severity   string `json:"severity"`   // HIGH, MEDIUM, LOW
	Confidence string `json:"confidence"` // HIGH, MEDIUM, LOW
	Details    string `json:"details"`
	File       string `json:"file"`
	Line       string `json:"line"`
	Nosec      bool   `json:"nosec"`
}

// ESLintFileResult mirrors a single file entry in the ESLint JSON output.
type ESLintFileResult struct {
	FilePath           string          `json:"filePath"`
	Messages           []ESLintMessage `json:"messages"`
	SuppressedMessages []ESLintMessage `json:"suppressedMessages"`
}

// ESLintMessage mirrors a single ESLint finding.
type ESLintMessage struct {
	RuleID   string `json:"ruleId"`
	Severity int    `json:"severity"` // 1=warn, 2=error
	Message  string `json:"message"`
}

// checkMapping maps a Scorecard or ESLint check name to a CWE ID, display name, and dimension.
type checkMapping struct {
	cwe         string
	displayName string
	dimension   string
}

// scorecardBlocklist contains Scorecard check names that are explicitly excluded
// from scoring. Checks are blocked because they are not applicable to the Grafana
// plugin ecosystem and would penalise every plugin equally, providing no
// discriminating signal.
var scorecardBlocklist = map[string]string{
	// Packaging: OpenSSF defines this as publishing to a recognised package registry
	// (npm, PyPI, etc.). The Grafana plugin catalog is not recognised, so this check
	// is noisy because it always fails for every plugin regardless of quality.
	"Packaging": "Grafana plugin catalog is not a recognised package registry by OpenSSF.",

	// Fuzzing: fuzz testing is not applicable to Grafana plugins. Frontend plugins
	// (React/TS) have no meaningful fuzz surface, and backend datasource plugins (Go)
	// are not directly exposed to untrusted input at the plugin boundary. This check
	// is noisy because it always fails for every plugin regardless of quality.
	"Fuzzing": "Not applicable to the Grafana plugin architecture.",
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
	"Security-Policy":    {cwe: "CWE-693", displayName: "Security-Policy", dimension: DimensionQuality},
	"CII-Best-Practices": {cwe: "CWE-1059", displayName: "CII-Best-Practices", dimension: DimensionQuality},
	"License":            {cwe: "CWE-1076", displayName: "License", dimension: DimensionQuality},

	// Community — maintenance health and adoption signals
	"Maintained": {cwe: "CWE-1104", displayName: "Maintained", dimension: DimensionCommunity},
}

// eslintChecks maps ESLint rule IDs to CWE, display name, and dimension.
// Safety: directly exploitable (code execution, XSS, data exfiltration).
// Quality: poor defensive practices, often context-dependent.
var eslintChecks = map[string]checkMapping{
	// Safety
	"security/detect-eval-with-expression":      {cwe: "CWE-95", displayName: "eval() with expression", dimension: DimensionSafety},
	"no-new-func":                               {cwe: "CWE-95", displayName: "new Function()", dimension: DimensionSafety},
	"no-implied-eval":                           {cwe: "CWE-95", displayName: "implied eval", dimension: DimensionSafety},
	"security/detect-child-process":             {cwe: "CWE-78", displayName: "child_process exec", dimension: DimensionSafety},
	"security/detect-non-literal-fs-filename":   {cwe: "CWE-22", displayName: "fs with variable path", dimension: DimensionSafety},
	"security/detect-non-literal-require":       {cwe: "CWE-94", displayName: "require(variable)", dimension: DimensionSafety},
	"security/detect-bidi-characters":           {cwe: "CWE-838", displayName: "bidirectional Unicode", dimension: DimensionSafety},
	"@microsoft/sdl/no-postmessage-star-origin": {cwe: "CWE-346", displayName: "postMessage wildcard origin", dimension: DimensionSafety},
	"@microsoft/sdl/no-inner-html":              {cwe: "CWE-79", displayName: "innerHTML assignment", dimension: DimensionSafety},
	"@microsoft/sdl/no-document-write":          {cwe: "CWE-79", displayName: "document.write()", dimension: DimensionSafety},
	"no-script-url":                             {cwe: "CWE-79", displayName: "javascript: URL", dimension: DimensionSafety},
	"@microsoft/sdl/no-insecure-url":            {cwe: "CWE-319", displayName: "hardcoded http:// URL", dimension: DimensionSafety},
	// Quality
	"security/detect-unsafe-regex":            {cwe: "CWE-400", displayName: "unsafe regex (ReDoS)", dimension: DimensionQuality},
	"security/detect-non-literal-regexp":      {cwe: "CWE-400", displayName: "RegExp(variable)", dimension: DimensionQuality},
	"security/detect-buffer-noassert":         {cwe: "CWE-119", displayName: "Buffer with noAssert", dimension: DimensionQuality},
	"security/detect-pseudoRandomBytes":       {cwe: "CWE-330", displayName: "weak random number generation", dimension: DimensionQuality},
	"security/detect-possible-timing-attacks": {cwe: "CWE-208", displayName: "possible timing attack", dimension: DimensionQuality},
	"security/detect-object-injection":        {cwe: "CWE-94", displayName: "object injection", dimension: DimensionQuality},
	"security/detect-disable-mustache-escape": {cwe: "CWE-116", displayName: "mustache escaping disabled", dimension: DimensionQuality},
}

// eslintFindingScore converts an ESLint message to a 0–10 contribution score.
// error (severity=2) → 0, warn (severity=1) → 5, suppressed → 7, clean → 10.
func eslintFindingScore(severity int, suppressed bool) float64 {
	if suppressed {
		return 7
	}
	switch severity {
	case 2:
		return 0
	case 1:
		return 5
	default:
		return 10
	}
}

// FromESLint converts ESLint JSON output into per-dimension items and sub-pool scores.
// Returns nil maps if no findings (e.g. no JS/TS files, empty scan).
func FromESLint(files []ESLintFileResult) (map[string][]InsightItem, map[string]float64, map[string]int) {
	if len(files) == 0 {
		return nil, nil, nil
	}

	items := map[string][]InsightItem{DimensionSafety: {}, DimensionQuality: {}}
	totals := map[string]float64{DimensionSafety: 0, DimensionQuality: 0}
	counts := map[string]int{DimensionSafety: 0, DimensionQuality: 0}

	// Deduplicate findings by ruleId across files — worst severity wins.
	type ruleState struct {
		maxSeverity int
		suppressed  bool
		mapping     checkMapping
	}
	seen := map[string]*ruleState{}

	for _, f := range files {
		for _, m := range f.Messages {
			if m.RuleID == "" {
				continue
			}
			mapping, ok := eslintChecks[m.RuleID]
			if !ok {
				mapping = checkMapping{cwe: noInfoID, displayName: m.RuleID, dimension: DimensionQuality}
			}
			if s, exists := seen[m.RuleID]; exists {
				if m.Severity > s.maxSeverity {
					s.maxSeverity = m.Severity
				}
			} else {
				seen[m.RuleID] = &ruleState{maxSeverity: m.Severity, mapping: mapping}
			}
		}
		for _, m := range f.SuppressedMessages {
			if m.RuleID == "" {
				continue
			}
			mapping, ok := eslintChecks[m.RuleID]
			if !ok {
				mapping = checkMapping{cwe: noInfoID, displayName: m.RuleID, dimension: DimensionQuality}
			}
			if _, exists := seen[m.RuleID]; !exists {
				seen[m.RuleID] = &ruleState{maxSeverity: 0, suppressed: true, mapping: mapping}
			}
		}
	}

	for _, state := range seen {
		dim := state.mapping.dimension
		if dim == DimensionCommunity {
			dim = DimensionQuality
		}
		isSuppressedOnly := state.suppressed && state.maxSeverity == 0
		score := eslintFindingScore(state.maxSeverity, isSuppressedOnly)
		totals[dim] += score
		counts[dim]++
		if score < 10 {
			name := state.mapping.displayName
			if isSuppressedOnly {
				name += " (suppressed)"
			}
			items[dim] = append(items[dim], InsightItem{
				ID:    state.mapping.cwe,
				Name:  name,
				Level: itemLevelWarning,
				Link:  cweRef(state.mapping.cwe),
			})
		}
	}

	return items, totals, counts
}

// gosecChecks maps gosec rule IDs to CWE and dimension.
// gosec only produces Safety and Quality findings — never Community.
var gosecChecks = map[string]checkMapping{
	// Safety — directly exploitable
	"G101": {cwe: "CWE-798", displayName: "hardcoded credentials", dimension: DimensionSafety},
	"G102": {cwe: "CWE-200", displayName: "bind to all interfaces", dimension: DimensionSafety},
	"G103": {cwe: "CWE-242", displayName: "use of unsafe package", dimension: DimensionSafety},
	"G107": {cwe: "CWE-88", displayName: "SSRF via variable URL", dimension: DimensionSafety},
	"G201": {cwe: "CWE-89", displayName: "SQL injection via format string", dimension: DimensionSafety},
	"G202": {cwe: "CWE-89", displayName: "SQL injection via string concat", dimension: DimensionSafety},
	"G203": {cwe: "CWE-79", displayName: "unescaped HTML template", dimension: DimensionSafety},
	"G204": {cwe: "CWE-78", displayName: "OS command injection", dimension: DimensionSafety},
	"G301": {cwe: "CWE-276", displayName: "overly permissive directory", dimension: DimensionSafety},
	"G302": {cwe: "CWE-276", displayName: "overly permissive file chmod", dimension: DimensionSafety},
	"G303": {cwe: "CWE-377", displayName: "predictable temp file path", dimension: DimensionSafety},
	"G304": {cwe: "CWE-22", displayName: "file path from variable", dimension: DimensionSafety},
	"G305": {cwe: "CWE-22", displayName: "file traversal in zip extraction", dimension: DimensionSafety},
	"G306": {cwe: "CWE-276", displayName: "overly permissive file permissions", dimension: DimensionSafety},
	"G401": {cwe: "CWE-327", displayName: "use of weak MD5 hash", dimension: DimensionSafety},
	"G402": {cwe: "CWE-295", displayName: "insecure TLS config", dimension: DimensionSafety},
	"G403": {cwe: "CWE-310", displayName: "RSA key below 2048 bits", dimension: DimensionSafety},
	"G404": {cwe: "CWE-338", displayName: "weak random source (math/rand)", dimension: DimensionSafety},
	"G501": {cwe: "CWE-327", displayName: "import of MD5", dimension: DimensionSafety},
	"G502": {cwe: "CWE-327", displayName: "import of DES", dimension: DimensionSafety},
	"G503": {cwe: "CWE-327", displayName: "import of RC4", dimension: DimensionSafety},
	"G504": {cwe: "CWE-327", displayName: "import of net/http/cgi", dimension: DimensionSafety},
	"G505": {cwe: "CWE-327", displayName: "import of SHA1", dimension: DimensionSafety},
	"G601": {cwe: "CWE-118", displayName: "implicit memory aliasing in loop", dimension: DimensionSafety},
	"G602": {cwe: "CWE-119", displayName: "slice access out of bounds", dimension: DimensionSafety},
	"G702": {cwe: "CWE-78", displayName: "OS command injection", dimension: DimensionSafety},
	"G703": {cwe: "CWE-22", displayName: "file path from taint", dimension: DimensionSafety},
	"G704": {cwe: "CWE-918", displayName: "SSRF via tainted URL", dimension: DimensionSafety},
	"G705": {cwe: "CWE-79", displayName: "unescaped template data", dimension: DimensionSafety},
	// Quality — poor defensive practices
	"G104": {cwe: "CWE-391", displayName: "unchecked error return", dimension: DimensionQuality},
	"G106": {cwe: "CWE-322", displayName: "use of ssh InsecureIgnoreHostKey", dimension: DimensionQuality},
	"G108": {cwe: "CWE-200", displayName: "pprof endpoint exposed", dimension: DimensionQuality},
	"G109": {cwe: "CWE-190", displayName: "integer overflow in strconv", dimension: DimensionQuality},
	"G110": {cwe: "CWE-409", displayName: "decompression bomb (io.Copy)", dimension: DimensionQuality},
	"G111": {cwe: "CWE-22", displayName: "http.Dir allows path traversal", dimension: DimensionQuality},
	"G112": {cwe: "CWE-400", displayName: "slowloris via missing ReadHeaderTimeout", dimension: DimensionQuality},
	"G113": {cwe: "CWE-682", displayName: "Rat.SetString overflow", dimension: DimensionQuality},
	"G114": {cwe: "CWE-676", displayName: "use of net.Listen with 0.0.0.0", dimension: DimensionQuality},
	"G115": {cwe: "CWE-190", displayName: "uint conversion to int may overflow", dimension: DimensionQuality},
	"G116": {cwe: "CWE-838", displayName: "bidirectional Unicode in string", dimension: DimensionQuality},
	"G117": {cwe: "CWE-499", displayName: "LDAP injection", dimension: DimensionQuality},
	"G118": {cwe: "CWE-400", displayName: "missing ReadTimeout", dimension: DimensionQuality},
	"G119": {cwe: "CWE-200", displayName: "sensitive data in network connection", dimension: DimensionQuality},
	"G120": {cwe: "CWE-400", displayName: "missing WriteTimeout", dimension: DimensionQuality},
}

// gosecSeverityScore converts a gosec severity string to a 0–10 score.
// HIGH → 0 (critical finding), MEDIUM → 4, LOW → 7, nosec suppressed → 8.
func gosecSeverityScore(severity string, nosec bool) float64 {
	if nosec {
		return 8
	}
	switch severity {
	case "HIGH":
		return 0
	case "MEDIUM":
		return 4
	case "LOW":
		return 7
	default:
		return 10
	}
}

// FromGosec converts gosec JSON output into per-dimension items and sub-pool scores.
// Returns nil maps if there are no issues (clean scan or no Go files).
func FromGosec(result *GosecResult) (map[string][]InsightItem, map[string]float64, map[string]int) {
	if result == nil || len(result.Issues) == 0 {
		return nil, nil, nil
	}

	items := map[string][]InsightItem{DimensionSafety: {}, DimensionQuality: {}}
	totals := map[string]float64{DimensionSafety: 0, DimensionQuality: 0}
	counts := map[string]int{DimensionSafety: 0, DimensionQuality: 0}

	// Deduplicate by ruleId — worst severity wins across all occurrences.
	type ruleState struct {
		worstSeverity string
		nosec         bool
		mapping       checkMapping
	}
	seen := map[string]*ruleState{}

	for _, issue := range result.Issues {
		if issue.RuleID == "" {
			continue
		}
		mapping, ok := gosecChecks[issue.RuleID]
		if !ok {
			mapping = checkMapping{cwe: noInfoID, displayName: issue.RuleID, dimension: DimensionQuality}
		}
		if s, exists := seen[issue.RuleID]; exists {
			// HIGH > MEDIUM > LOW
			if severityRank(issue.Severity) > severityRank(s.worstSeverity) {
				s.worstSeverity = issue.Severity
			}
			if issue.Nosec {
				s.nosec = true
			}
		} else {
			seen[issue.RuleID] = &ruleState{
				worstSeverity: issue.Severity,
				nosec:         issue.Nosec,
				mapping:       mapping,
			}
		}
	}

	for _, state := range seen {
		dim := state.mapping.dimension
		score := gosecSeverityScore(state.worstSeverity, state.nosec)
		totals[dim] += score
		counts[dim]++
		if score < 10 {
			name := state.mapping.displayName
			if state.nosec {
				name += " (suppressed)"
			}
			items[dim] = append(items[dim], InsightItem{
				ID:    state.mapping.cwe,
				Name:  name,
				Level: itemLevelWarning,
				Link:  cweRef(state.mapping.cwe),
			})
		}
	}

	return items, totals, counts
}

func severityRank(s string) int {
	switch s {
	case "HIGH":
		return 3
	case "MEDIUM":
		return 2
	case "LOW":
		return 1
	default:
		return 0
	}
}

// Merge combines Scorecard, ESLint, and gosec results into a single CatalogPluginInsights.
//
// Weighting within Safety and Quality dimensions:
//   - Scorecard: 50% Safety, 75% Quality
//   - ESLint:    25% Safety, 12.5% Quality
//   - gosec:     25% Safety, 12.5% Quality
//
// If a scanner produced no data, its weight is redistributed proportionally to
// the scanners that did produce data. Community dimension uses Scorecard only.
func Merge(pluginID, version string, sc *ScorecardResult, eslint []ESLintFileResult, gosec *GosecResult) CatalogPluginInsights {
	// Build Scorecard sub-pools
	scItems := map[string][]InsightItem{DimensionSafety: {}, DimensionQuality: {}, DimensionCommunity: {}}
	scTotals := map[string]int{DimensionSafety: 0, DimensionQuality: 0, DimensionCommunity: 0}
	scCounts := map[string]int{DimensionSafety: 0, DimensionQuality: 0, DimensionCommunity: 0}

	if sc != nil {
		for _, c := range sc.Checks {
			if _, blocked := scorecardBlocklist[c.Name]; blocked {
				continue
			}
			m, ok := scorecardChecks[c.Name]
			if !ok {
				m = checkMapping{cwe: noInfoID, displayName: c.Name, dimension: DimensionQuality}
			}
			if c.Score >= 0 {
				scTotals[m.dimension] += c.Score
				scCounts[m.dimension]++
			}
			if c.Score < 10 {
				scItems[m.dimension] = append(scItems[m.dimension], InsightItem{
					ID:    m.cwe,
					Name:  m.displayName,
					Level: itemLevelWarning,
					Link:  cweRef(m.cwe),
				})
			}
		}
	}

	elItems, elTotals, elCounts := FromESLint(eslint)
	goItems, goTotals, goCounts := FromGosec(gosec)

	var categories []InsightCategory
	for _, dim := range []string{DimensionSafety, DimensionQuality, DimensionCommunity} {
		scScore := 100.0
		if scCounts[dim] > 0 {
			scScore = float64(scTotals[dim]) / float64(scCounts[dim]) * 10.0
		}

		allItems := append(scItems[dim], elItems[dim]...)
		allItems = append(allItems, goItems[dim]...)

		var finalScore float64
		if dim == DimensionCommunity {
			finalScore = scScore
		} else {
			// Compute available SAST scores
			hasESLint := elItems != nil
			hasGosec := goItems != nil

			elScore := 100.0
			if hasESLint && elCounts[dim] > 0 {
				elScore = elTotals[dim] / float64(elCounts[dim]) * 10.0
			}
			goScore := 100.0
			if hasGosec && goCounts[dim] > 0 {
				goScore = goTotals[dim] / float64(goCounts[dim]) * 10.0
			}

			// Weights: Scorecard 50%, ESLint 25%, gosec 25%.
			// Redistribute weight from absent scanners proportionally.
			scW, elW, goW := 0.5, 0.25, 0.25
			if !hasESLint && !hasGosec {
				scW, elW, goW = 1.0, 0, 0
			} else if !hasESLint {
				scW, elW, goW = 0.75, 0, 0.25
			} else if !hasGosec {
				scW, elW, goW = 0.75, 0.25, 0
			}
			finalScore = (scScore * scW) + (elScore * elW) + (goScore * goW)
		}

		categories = append(categories, InsightCategory{
			Name:       dim,
			Items:      allItems,
			ScoreValue: finalScore,
			ScoreLevel: scoreLevelFromValue(finalScore),
		})
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
		if _, blocked := scorecardBlocklist[c.Name]; blocked {
			continue
		}
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
