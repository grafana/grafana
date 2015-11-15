package search

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wangy1931/grafana/pkg/log"
	m "github.com/wangy1931/grafana/pkg/models"
)

type JsonDashIndex struct {
	path  string
	items []*JsonDashIndexItem
}

type JsonDashIndexItem struct {
	TitleLower string
	TagsCsv    string
	Path       string
	Dashboard  *m.Dashboard
}

func NewJsonDashIndex(path string) *JsonDashIndex {
	log.Info("Creating json dashboard index for path: %v", path)

	index := JsonDashIndex{}
	index.path = path
	index.updateIndex()
	return &index
}

func (index *JsonDashIndex) updateLoop() {
	ticker := time.NewTicker(time.Minute)
	for {
		select {
		case <-ticker.C:
			if err := index.updateIndex(); err != nil {
				log.Error(3, "Failed to update dashboard json index %v", err)
			}
		}
	}
}

func (index *JsonDashIndex) Search(query *Query) ([]*Hit, error) {
	results := make([]*Hit, 0)

	if query.IsStarred {
		return results, nil
	}

	queryStr := strings.ToLower(query.Title)

	for _, item := range index.items {
		if len(results) > query.Limit {
			break
		}

		// add results with matchig title filter
		if strings.Contains(item.TitleLower, queryStr) {
			results = append(results, &Hit{
				Type:  DashHitJson,
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
	var items = make([]*JsonDashIndexItem, 0)

	visitor := func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if f.IsDir() {
			return nil
		}

		if strings.HasSuffix(f.Name(), ".json") {
			dash, err := loadDashboardFromFile(path)
			if err != nil {
				return err
			}

			items = append(items, dash)
		}

		return nil
	}

	if err := filepath.Walk(index.path, visitor); err != nil {
		return err
	}

	index.items = items
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
