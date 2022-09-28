package searchV2

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/models"
)

func TestHitsToFrame(t *testing.T) {
	hits := models.HitList{
		&models.Hit{UID: "A", Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}, URL: "http://A"},
		&models.Hit{UID: "B", Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}, FolderUID: "F1", FolderTitle: "Folder1", FolderURL: "http://f1"},
		&models.Hit{UID: "C", Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}, URL: "http://C"},
		&models.Hit{UID: "D", Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}, URL: "http://D"},
		&models.Hit{UID: "E", Title: "FOLDER", Type: "dash-folder"},
	}

	frame := hitListToFrame(hits)

	experimental.CheckGoldenJSONFrame(t, "testdata", "fallback-hits", frame, true)
}
