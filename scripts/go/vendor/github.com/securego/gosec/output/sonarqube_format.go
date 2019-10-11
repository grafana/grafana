package output

type textRange struct {
	StartLine   int `json:"startLine"`
	EndLine     int `json:"endLine"`
	StartColumn int `json:"startColumn,omitempty"`
	EtartColumn int `json:"endColumn,omitempty"`
}
type location struct {
	Message   string    `json:"message"`
	FilePath  string    `json:"filePath"`
	TextRange textRange `json:"textRange,omitempty"`
}

type sonarIssue struct {
	EngineID           string     `json:"engineId"`
	RuleID             string     `json:"ruleId"`
	PrimaryLocation    location   `json:"primaryLocation"`
	Type               string     `json:"type"`
	Severity           string     `json:"severity"`
	EffortMinutes      int        `json:"effortMinutes"`
	SecondaryLocations []location `json:"secondaryLocations,omitempty"`
}

type sonarIssues struct {
	SonarIssues []sonarIssue `json:"issues"`
}

func getSonarSeverity(s string) string {
	switch s {
	case "LOW":
		return "MINOR"
	case "MEDIUM":
		return "MAJOR"
	case "HIGH":
		return "BLOCKER"
	default:
		return "INFO"
	}
}
