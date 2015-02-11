package raintankdashbuilder

import  (
	"fmt"
	"bytes"
	"path"
	"regexp"
	"strings"
	"text/template"
	"encoding/json"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type SiteSummaryData struct {
	SiteId    int64
	DashId    int64
	AccountId int64
	Title     string
	Tags      string
	Panels    []*SummaryPanel
}

type SummaryPanel struct {
	Id           int64
	Title        string
	Protocol     string
	Slug         string
	Metric       string
	Last         bool
}

func DashboardSlug(name string) string {
	title := strings.ToLower(name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	return re2.ReplaceAllString(re.ReplaceAllString(title, ""), "-")
}

func SiteSummary(data *SiteSummaryData) (map[string]interface{}, error) {
	query := m.GetMonitorsQuery{
		SiteId: []int64{data.SiteId},
		AccountId: data.AccountId,
	}
	if err := bus.Dispatch(&query); err != nil {
                return nil, err
        }
	metricMap := map[string]string{
		"http": "total",
		"https": "total",
		"ping":  "avg",
		"dns":   "time",
	}
	protoMap := map[int64]string{
		1: "http",
	}
	count := 0
	numPanels := len(query.Result)
	for _, mon := range query.Result {
		count++
		fmt.Println("found monitor %d", mon.Id)
		proto := protoMap[mon.MonitorTypeId]
		data.Panels = append(data.Panels, &SummaryPanel{
			Id:       int64(count),
			Title:    mon.Name,
			Slug:     mon.Slug,
			Protocol: proto,
			Metric:   metricMap[proto],
			Last:     (count == numPanels),
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


