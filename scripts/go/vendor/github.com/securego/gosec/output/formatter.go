// (c) Copyright 2016 Hewlett Packard Enterprise Development LP
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package output

import (
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	htmlTemplate "html/template"
	"io"
	"strconv"
	"strings"
	plainTemplate "text/template"

	"github.com/securego/gosec"
	"gopkg.in/yaml.v2"
)

// ReportFormat enumerates the output format for reported issues
type ReportFormat int

const (
	// ReportText is the default format that writes to stdout
	ReportText ReportFormat = iota // Plain text format

	// ReportJSON set the output format to json
	ReportJSON // Json format

	// ReportCSV set the output format to csv
	ReportCSV // CSV format

	// ReportJUnitXML set the output format to junit xml
	ReportJUnitXML // JUnit XML format

	//SonarqubeEffortMinutes effort to fix in minutes
	SonarqubeEffortMinutes = 5
)

var text = `Results:
{{range $filePath,$fileErrors := .Errors}}
Golang errors in file: [{{ $filePath }}]:
{{range $index, $error := $fileErrors}}
  > [line {{$error.Line}} : column {{$error.Column}}] - {{$error.Err}}
{{end}}
{{end}}
{{ range $index, $issue := .Issues }}
[{{ $issue.File }}:{{ $issue.Line }}] - {{ $issue.RuleID }}: {{ $issue.What }} (Confidence: {{ $issue.Confidence}}, Severity: {{ $issue.Severity }})
  > {{ $issue.Code }}

{{ end }}
Summary:
   Files: {{.Stats.NumFiles}}
   Lines: {{.Stats.NumLines}}
   Nosec: {{.Stats.NumNosec}}
  Issues: {{.Stats.NumFound}}

`

type reportInfo struct {
	Errors map[string][]gosec.Error `json:"Golang errors"`
	Issues []*gosec.Issue
	Stats  *gosec.Metrics
}

// CreateReport generates a report based for the supplied issues and metrics given
// the specified format. The formats currently accepted are: json, csv, html and text.
func CreateReport(w io.Writer, format string, rootPaths []string, issues []*gosec.Issue, metrics *gosec.Metrics, errors map[string][]gosec.Error) error {
	data := &reportInfo{
		Errors: errors,
		Issues: issues,
		Stats:  metrics,
	}
	var err error
	switch format {
	case "json":
		err = reportJSON(w, data)
	case "yaml":
		err = reportYAML(w, data)
	case "csv":
		err = reportCSV(w, data)
	case "junit-xml":
		err = reportJUnitXML(w, data)
	case "html":
		err = reportFromHTMLTemplate(w, html, data)
	case "text":
		err = reportFromPlaintextTemplate(w, text, data)
	case "sonarqube":
		err = reportSonarqube(rootPaths, w, data)
	default:
		err = reportFromPlaintextTemplate(w, text, data)
	}
	return err
}

func reportSonarqube(rootPaths []string, w io.Writer, data *reportInfo) error {
	si, err := convertToSonarIssues(rootPaths, data)
	if err != nil {
		return err
	}
	raw, err := json.MarshalIndent(si, "", "\t")
	if err != nil {
		return err
	}
	_, err = w.Write(raw)
	return err
}

func convertToSonarIssues(rootPaths []string, data *reportInfo) (*sonarIssues, error) {
	si := &sonarIssues{[]sonarIssue{}}
	for _, issue := range data.Issues {
		var sonarFilePath string
		for _, rootPath := range rootPaths {
			if strings.HasPrefix(issue.File, rootPath) {
				sonarFilePath = strings.Replace(issue.File, rootPath+"/", "", 1)
			}
		}
		if sonarFilePath == "" {
			continue
		}

		lines := strings.Split(issue.Line, "-")
		startLine, err := strconv.Atoi(lines[0])
		if err != nil {
			return si, err
		}
		endLine := startLine
		if len(lines) > 1 {
			endLine, err = strconv.Atoi(lines[1])
			if err != nil {
				return si, err
			}
		}

		s := sonarIssue{
			EngineID: "gosec",
			RuleID:   issue.RuleID,
			PrimaryLocation: location{
				Message:   issue.What,
				FilePath:  sonarFilePath,
				TextRange: textRange{StartLine: startLine, EndLine: endLine},
			},
			Type:          "VULNERABILITY",
			Severity:      getSonarSeverity(issue.Severity.String()),
			EffortMinutes: SonarqubeEffortMinutes,
		}
		si.SonarIssues = append(si.SonarIssues, s)
	}
	return si, nil
}

func reportJSON(w io.Writer, data *reportInfo) error {
	raw, err := json.MarshalIndent(data, "", "\t")
	if err != nil {
		return err
	}

	_, err = w.Write(raw)
	return err
}

func reportYAML(w io.Writer, data *reportInfo) error {
	raw, err := yaml.Marshal(data)
	if err != nil {
		return err
	}
	_, err = w.Write(raw)
	return err
}

func reportCSV(w io.Writer, data *reportInfo) error {
	out := csv.NewWriter(w)
	defer out.Flush()
	for _, issue := range data.Issues {
		err := out.Write([]string{
			issue.File,
			issue.Line,
			issue.What,
			issue.Severity.String(),
			issue.Confidence.String(),
			issue.Code,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func reportJUnitXML(w io.Writer, data *reportInfo) error {
	groupedData := groupDataByRules(data)
	junitXMLStruct := createJUnitXMLStruct(groupedData)

	raw, err := xml.MarshalIndent(junitXMLStruct, "", "\t")
	if err != nil {
		return err
	}

	xmlHeader := []byte("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
	raw = append(xmlHeader, raw...)
	_, err = w.Write(raw)
	if err != nil {
		return err
	}

	return nil
}

func reportFromPlaintextTemplate(w io.Writer, reportTemplate string, data *reportInfo) error {
	t, e := plainTemplate.New("gosec").Parse(reportTemplate)
	if e != nil {
		return e
	}

	return t.Execute(w, data)
}

func reportFromHTMLTemplate(w io.Writer, reportTemplate string, data *reportInfo) error {
	t, e := htmlTemplate.New("gosec").Parse(reportTemplate)
	if e != nil {
		return e
	}

	return t.Execute(w, data)
}
