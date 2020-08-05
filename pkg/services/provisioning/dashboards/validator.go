package dashboards

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

type duplicate struct {
	Sum             uint8
	InvolvedReaders map[string]struct{}
}

func newDuplicate() *duplicate {
	return &duplicate{InvolvedReaders: make(map[string]struct{})}
}

type duplicateEntries struct {
	Titles map[dashboardIdentity]*duplicate
	UIDs   map[string]*duplicate
}

func newDuplicateEntries() *duplicateEntries {
	return &duplicateEntries{Titles: make(map[dashboardIdentity]*duplicate), UIDs: make(map[string]*duplicate)}
}

type duplicateValidator struct {
	readers []*FileReader
}

func newDuplicateValidator(readers []*FileReader) *duplicateValidator {
	return &duplicateValidator{readers: readers}
}

func (c *duplicateValidator) getDuplicates() *duplicateEntries {
	duplicates := newDuplicateEntries()

	for _, reader := range c.readers {
		readerName := reader.Cfg.Name
		tracker := reader.getUsageTracker()
		for uid, times := range tracker.uidUsage {
			if _, ok := duplicates.UIDs[uid]; !ok {
				duplicates.UIDs[uid] = newDuplicate()
			}
			duplicates.UIDs[uid].Sum += times
			duplicates.UIDs[uid].InvolvedReaders[reader.Cfg.Name] = struct{}{}
		}

		for id, times := range tracker.titleUsage {
			if _, ok := duplicates.Titles[id]; !ok {
				duplicates.Titles[id] = newDuplicate()
			}
			duplicates.Titles[id].Sum += times
			duplicates.Titles[id].InvolvedReaders[readerName] = struct{}{}
		}
	}

	return duplicates
}

func (c *duplicateValidator) logWarnings(log log.Logger) {
	duplicates := c.getDuplicates()
	for uid, usage := range duplicates.UIDs {
		if usage.Sum > 1 {
			log.Error("the same uid is used more than once", "uid", uid, "times", usage.Sum, "providers", keysToSlice(usage.InvolvedReaders))
		}
	}

	for id, usage := range duplicates.Titles {
		if usage.Sum > 1 {
			log.Error("dashboard title is not unique in folder", "title", id.title, "folderID", id.folderID, "times", usage.Sum, "providers", keysToSlice(usage.InvolvedReaders))
		}
	}
}

func (c *duplicateValidator) startLogWarningsLoop(ctx context.Context, log log.Logger) {
	ticker := time.NewTicker(30 * time.Second)
	for {
		select {
		case <-ticker.C:
			c.logWarnings(log)
		case <-ctx.Done():
			return
		}
	}
}

func keysToSlice(data map[string]struct{}) []string {
	entries := make([]string, 0, len(data))

	for entry := range data {
		entries = append(entries, entry)
	}

	return entries
}
