package search

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type JsonDashIndex struct {
	path    string
	orgsIds []int64
	items   []*JsonDashIndexItem
}

type JsonDashIndexItem struct {
	TitleLower string
	TagsCsv    string
	Path       string
	Dashboard  *m.Dashboard
}

func NewJsonDashIndex(path string, orgIds string) *JsonDashIndex {
	index := JsonDashIndex{}
	index.path = path
	// if orgIds != ""  || orgIds != "*" {
	// }

	index.updateIndex()
	return &index
}

func (index *JsonDashIndex) Search(query *Query) ([]*m.DashboardSearchHit, error) {
	results := make([]*m.DashboardSearchHit, 0)

	for _, item := range index.items {
		if strings.Contains(item.TitleLower, query.Title) {
			results = append(results, &m.DashboardSearchHit{
				Title: item.Dashboard.Title,
				Tags:  item.Dashboard.GetTags(),
				Uri:   "file/" + item.Path,
			})
		}
	}

	return results, nil
}

func (index *JsonDashIndex) GetDashboard(path string) *m.Dashboard {
	for _, item := range index.items {
		if item.Path == path {
			return item.Dashboard
		}
	}

	return nil
}

func (index *JsonDashIndex) updateIndex() error {
	log.Info("Updating JSON dashboard index, path: %v", index.path)

	index.items = make([]*JsonDashIndexItem, 0)

	visitor := func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if f.IsDir() {
			return nil
		}
		if strings.HasSuffix(f.Name(), ".json") {
			err = index.loadDashboardIntoCache(path)
			if err != nil {
				return err
			}
		}
		return nil
	}

	if err := filepath.Walk(index.path, visitor); err != nil {
		return err
	}

	return nil
}

func (index *JsonDashIndex) loadDashboardIntoCache(filename string) error {
	dash, err := loadDashboardFromFile(filename)
	if err != nil {
		return err
	}

	index.items = append(index.items, dash)
	return nil
}

func loadDashboardFromFile(filename string) (*JsonDashIndexItem, error) {
	reader, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	jsonParser := json.NewDecoder(reader)
	var data map[string]interface{}

	if err := jsonParser.Decode(&data); err != nil {
		return nil, err
	}

	stat, _ := os.Stat(filename)

	item := &JsonDashIndexItem{}
	item.Dashboard = m.NewDashboardFromJson(data)
	item.TitleLower = strings.ToLower(item.Dashboard.Title)
	item.TagsCsv = strings.Join(item.Dashboard.GetTags(), ",")
	item.Path = stat.Name()

	return item, nil
}
