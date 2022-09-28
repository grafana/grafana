package searchV2

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/models"
)

func TestHitsToFrame(t *testing.T) {
	hits := models.HitList{
		&models.Hit{UID: "A", Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
		&models.Hit{UID: "B", Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
		&models.Hit{UID: "C", Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&models.Hit{UID: "D", Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&models.Hit{UID: "E", Title: "FOLDER", Type: "dash-folder"},
	}

	frame := hitListToFrame(hits)

	experimental.CheckGoldenJSONFrame(t, "testdata", "fallback-hits", frame, true)
}
