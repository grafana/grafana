package printers

import (
	"context"
	"encoding/xml"
	"strings"

	"github.com/golangci/golangci-lint/pkg/logutils"
	"github.com/golangci/golangci-lint/pkg/result"
)

type testSuitesXML struct {
	XMLName    xml.Name `xml:"testsuites"`
	TestSuites []testSuiteXML
}

type testSuiteXML struct {
	XMLName   xml.Name      `xml:"testsuite"`
	Suite     string        `xml:"name,attr"`
	TestCases []testCaseXML `xml:"testcase"`
}

type testCaseXML struct {
	Name      string     `xml:"name,attr"`
	ClassName string     `xml:"classname,attr"`
	Failure   failureXML `xml:"failure"`
}

type failureXML struct {
	Message string `xml:"message,attr"`
	Content string `xml:",cdata"`
}

type JunitXML struct {
}

func NewJunitXML() *JunitXML {
	return &JunitXML{}
}

func (JunitXML) Print(ctx context.Context, issues []result.Issue) error {
	suites := make(map[string]testSuiteXML) // use a map to group by file

	for _, i := range issues {
		suiteName := i.FilePath()
		testSuite := suites[suiteName]
		testSuite.Suite = i.FilePath()

		tc := testCaseXML{
			Name:      i.FromLinter,
			ClassName: i.Pos.String(),
			Failure: failureXML{
				Message: i.Text,
				Content: strings.Join(i.SourceLines, "\n"),
			},
		}

		testSuite.TestCases = append(testSuite.TestCases, tc)
		suites[suiteName] = testSuite
	}

	var res testSuitesXML
	for _, val := range suites {
		res.TestSuites = append(res.TestSuites, val)
	}

	enc := xml.NewEncoder(logutils.StdOut)
	enc.Indent("", "  ")
	if err := enc.Encode(res); err != nil {
		return err
	}
	return nil
}
