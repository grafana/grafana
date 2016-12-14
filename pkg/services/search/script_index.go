package search

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type DashboardScriptIndex struct {
	path  string
	items []*DashboardScript
}

type DashboardScript struct {
	Name string
	Path string
}

func (s *DashboardScript) String() string {
	return "name=" + s.Name + ";path=" + s.Path
}

func NewDashboardScriptIndex(path string) *DashboardScriptIndex {
	log.Info("Creating scripted dashboard index for path: %v", path)

	index := DashboardScriptIndex{}
	index.path = path
	index.updateIndex()
	return &index
}

func (index *DashboardScriptIndex) updateLoop() {
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

func (index *DashboardScriptIndex) GetScript(name string) *DashboardScript {
	for _, item := range index.items {
		if item.Name == name {
			return item
		}
	}

	return nil
}

func (index *DashboardScriptIndex) updateIndex() error {
	var items = make([]*DashboardScript, 0)

	visitor := func(path string, f os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if f.IsDir() {
			return nil
		}

		if strings.HasSuffix(f.Name(), ".js") {
			stat, _ := os.Stat(path)

			item := &DashboardScript{}
			item.Name = stat.Name()
			item.Path = path
			items = append(items, item)
		}

		return nil
	}

	if err := filepath.Walk(index.path, visitor); err != nil {
		return err
	}

	index.items = items
	return nil
}
