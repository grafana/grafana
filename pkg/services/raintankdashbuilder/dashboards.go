package raintankdashbuilder

import (
	"bytes"
	"fmt"
	"encoding/json"
	"path"
	"regexp"
	"strings"
	"text/template"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	metricMap = map[string]string{
		"http":  "total",
		"https": "total",
		"ping":  "avg",
		"dns":   "time",
	}
)

type SiteSummaryData struct {
	SiteId    int64
	DashId    int64
	AccountId int64
	Title     string
	Tags      string
	Monitors  []*m.MonitorDTO
	Panels    []*SummaryPanel
}

type SummaryPanel struct {
	Id        int64
	Title     string
	Protocol  string
	Slug      string
	Metric    string
	Namespace string
	Last      bool
}

type MonitorSummaryData struct {
	DashId    int64
	SiteId    int64
	AccountId int64
	Slug      string
	Title     string
	Tags      string
	Protocol  string
	Metric    string
	Namespace string
}

type MonitorDetailData struct {
	SiteId    int64
	DashId    int64
	Slug      string
	AccountId int64
	Title     string
	Tags      string
	Namespace string
	Protocol  string
	Locations []*m.Location
	Panels    []*DetailPanel
}

type DetailPanel struct {
	Id        int64
	Title     string
	Protocol  string
	Slug      string
	Namespace string
	Location  string
	Last      bool
}

func DashboardSlug(name string) string {
	title := strings.ToLower(name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	return re2.ReplaceAllString(re.ReplaceAllString(title, ""), "-")
}

func SiteSummary(data *SiteSummaryData) (map[string]interface{}, error) {
	count := 0
	numPanels := len(data.Monitors)
	for _, mon := range data.Monitors {
		count++
		proto, err := getMonitorTypeName(mon.MonitorTypeId)
		if err != nil {
			return nil, err
		}
		proto = strings.ToLower(proto)
		data.Panels = append(data.Panels, &SummaryPanel{
			Id:        int64(count),
			Title:     mon.Name,
			Slug:      mon.Slug,
			Protocol:  proto,
			Metric:    metricMap[proto],
			Namespace: mon.Namespace,
			Last:      (count == numPanels),
		})
	}

	filePath := path.Join(setting.StaticRootPath, "dashboards/siteSummary.json.tmpl")
	tmpl, err := template.ParseFiles(filePath)
	if err != nil {
		return nil, err
	}
	var dashboardStr bytes.Buffer
	err = tmpl.Execute(&dashboardStr, &data)
	if err != nil {
		return nil, err
	}
	var dashboard map[string]interface{}
	err = json.Unmarshal(dashboardStr.Bytes(), &dashboard)
	if err != nil {
		return nil, err
	}
	return dashboard, nil
}

func MonitorSummary(data *MonitorSummaryData) (map[string]interface{}, error) {
	data.Metric = metricMap[data.Protocol]
	filePath := path.Join(setting.StaticRootPath, "dashboards/monitorSummary.json.tmpl")
	tmpl, err := template.ParseFiles(filePath)
	if err != nil {
		return nil, err
	}
	var dashboardStr bytes.Buffer
	err = tmpl.Execute(&dashboardStr, &data)
	if err != nil {
		return nil, err
	}
	var dashboard map[string]interface{}
	err = json.Unmarshal(dashboardStr.Bytes(), &dashboard)
	if err != nil {
		return nil, err
	}
	return dashboard, nil
}

func MonitorDetail(data *MonitorDetailData) (map[string]interface{}, error) {
	count := 0
	numPanels := len(data.Locations)
	for _, loc := range data.Locations {
		count++
		data.Panels = append(data.Panels, &DetailPanel{
			Id:        int64(count),
			Title:     loc.Name,
			Slug:      data.Slug,
			Protocol:  data.Protocol,
			Namespace: data.Namespace,
			Last:      (count == numPanels),
			Location:  loc.Slug,
		})
	}
	templateName := fmt.Sprintf("dashboards/%sMonitorDetail.json.tmpl", data.Protocol)
	filePath := path.Join(setting.StaticRootPath, templateName)
	tmpl, err := template.ParseFiles(filePath)
	if err != nil {
		return nil, err
	}
	var dashboardStr bytes.Buffer

	err = tmpl.Execute(&dashboardStr, &data)
	if err != nil {
		return nil, err
	}
	var dashboard map[string]interface{}
	err = json.Unmarshal(dashboardStr.Bytes(), &dashboard)
	if err != nil {
		return nil, err
	}
	return dashboard, nil
}