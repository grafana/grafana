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

func (d *duplicateEntries) InvolvedReaders() map[string]struct{} {
	involvedReaders := make(map[string]struct{})

	for _, duplicate := range d.UIDs {
		if duplicate.Sum <= 1 {
			continue
		}

		for readerName := range duplicate.InvolvedReaders {
			involvedReaders[readerName] = struct{}{}
		}
	}

	for _, duplicate := range d.Titles {
		if duplicate.Sum <= 1 {
			continue
		}

		for readerName := range duplicate.InvolvedReaders {
			involvedReaders[readerName] = struct{}{}
		}
	}

	return involvedReaders
}

type duplicateValidator struct {
	readers []*FileReader
}

func newDuplicateValidator(readers []*FileReader) duplicateValidator {
	return duplicateValidator{readers: readers}
}

func (c *duplicateValidator) getDuplicates() *duplicateEntries {
	duplicates := duplicateEntries{
		Titles: make(map[dashboardIdentity]*duplicate),
		UIDs:   make(map[string]*duplicate),
	}

	for _, reader := range c.readers {
		readerName := reader.Cfg.Name
		tracker := reader.getUsageTracker()

		for uid, times := range tracker.uidUsage {
			if _, ok := duplicates.UIDs[uid]; !ok {
				duplicates.UIDs[uid] = newDuplicate()
			}
			duplicates.UIDs[uid].Sum += times
			duplicates.UIDs[uid].InvolvedReaders[readerName] = struct{}{}
		}

		for id, times := range tracker.titleUsage {
			if _, ok := duplicates.Titles[id]; !ok {
				duplicates.Titles[id] = newDuplicate()
			}
			duplicates.Titles[id].Sum += times
			duplicates.Titles[id].InvolvedReaders[readerName] = struct{}{}
		}
	}

	return &duplicates
}

func (c *duplicateValidator) logWarnings(log log.Logger, duplicates *duplicateEntries) {
	for uid, usage := range duplicates.UIDs {
		if usage.Sum > 1 {
			log.Warn("the same UID is used more than once", "uid", uid, "times", usage.Sum, "providers",
				keysToSlice(usage.InvolvedReaders))
		}
	}

	for id, usage := range duplicates.Titles {
		if usage.Sum > 1 {
			log.Warn("dashboard title is not unique in folder", "title", id.title, "folderID", id.folderID, "times", 
				usage.Sum, "providers", keysToSlice(usage.InvolvedReaders))
		}
	}
}

func (c *duplicateValidator) takeAwayWritePermissions(log log.Logger, duplicates *duplicateEntries) {
	involvedReaders := duplicates.InvolvedReaders()
	for _, reader := range c.readers {
		_, isReaderWithDuplicates := involvedReaders[reader.Cfg.Name]
		// We restrict reader permissions to write to the database here to prevent overloading
		reader.changeWritePermissions(isReaderWithDuplicates)

		if isReaderWithDuplicates {
			log.Warn("dashboards provisioning provider has no database write permissions because of duplicates", "provider", reader.Cfg.Name)
		}
	}
}

func (c *duplicateValidator) Run(ctx context.Context, log log.Logger) {
	ticker := time.NewTicker(30 * time.Second)
	for {
		select {
		case <-ticker.C:
			c.validate(log)
		case <-ctx.Done():
			return
		}
	}
}

func (c *duplicateValidator) validate(log log.Logger) {
	duplicates := c.getDuplicates()

	c.logWarnings(log, duplicates)
	c.takeAwayWritePermissions(log, duplicates)
}

func keysToSlice(data map[string]struct{}) []string {
	entries := make([]string, 0, len(data))

	for entry := range data {
		entries = append(entries, entry)
	}

	return entries
}
