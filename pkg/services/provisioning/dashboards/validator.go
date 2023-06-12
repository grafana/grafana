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
	logger  log.Logger
	readers []*FileReader
}

func newDuplicateValidator(logger log.Logger, readers []*FileReader) duplicateValidator {
	return duplicateValidator{logger: logger, readers: readers}
}

func (c *duplicateValidator) getDuplicates() map[int64]duplicateEntries {
	duplicatesByOrg := map[int64]duplicateEntries{}

	for _, reader := range c.readers {
		readerName := reader.Cfg.Name
		orgID := reader.Cfg.OrgID
		tracker := reader.getUsageTracker()

		if _, exists := duplicatesByOrg[orgID]; !exists {
			duplicatesByOrg[orgID] = duplicateEntries{
				Titles: make(map[dashboardIdentity]*duplicate),
				UIDs:   make(map[string]*duplicate),
			}
		}

		for uid, times := range tracker.uidUsage {
			if _, ok := duplicatesByOrg[orgID].UIDs[uid]; !ok {
				duplicatesByOrg[orgID].UIDs[uid] = newDuplicate()
			}
			duplicatesByOrg[orgID].UIDs[uid].Sum += times
			duplicatesByOrg[orgID].UIDs[uid].InvolvedReaders[readerName] = struct{}{}
		}

		for id, times := range tracker.titleUsage {
			if _, ok := duplicatesByOrg[orgID].Titles[id]; !ok {
				duplicatesByOrg[orgID].Titles[id] = newDuplicate()
			}
			duplicatesByOrg[orgID].Titles[id].Sum += times
			duplicatesByOrg[orgID].Titles[id].InvolvedReaders[readerName] = struct{}{}
		}
	}

	return duplicatesByOrg
}

func (c *duplicateValidator) logWarnings(duplicatesByOrg map[int64]duplicateEntries) {
	for orgID, duplicates := range duplicatesByOrg {
		for uid, usage := range duplicates.UIDs {
			if usage.Sum > 1 {
				c.logger.Warn("the same UID is used more than once", "orgId", orgID, "uid", uid, "times", usage.Sum, "providers",
					keysToSlice(usage.InvolvedReaders))
			}
		}

		for id, usage := range duplicates.Titles {
			if usage.Sum > 1 {
				c.logger.Warn("dashboard title is not unique in folder", "orgId", orgID, "title", id.title, "folderID", id.folderID, "times",
					usage.Sum, "providers", keysToSlice(usage.InvolvedReaders))
			}
		}
	}
}

func (c *duplicateValidator) takeAwayWritePermissions(duplicatesByOrg map[int64]duplicateEntries) {
	// reset write permissions for all readers
	for _, reader := range c.readers {
		reader.changeWritePermissions(false)
	}

	for orgID, duplicates := range duplicatesByOrg {
		involvedReaders := duplicates.InvolvedReaders()
		for _, reader := range c.readers {
			_, exists := involvedReaders[reader.Cfg.Name]

			if exists {
				// We restrict reader permissions to write to the database here to prevent overloading
				reader.changeWritePermissions(true)
				c.logger.Warn("dashboards provisioning provider has no database write permissions because of duplicates", "provider", reader.Cfg.Name, "orgId", orgID)
			}
		}
	}
}

func (c *duplicateValidator) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	for {
		select {
		case <-ticker.C:
			c.validate()
		case <-ctx.Done():
			return
		}
	}
}

func (c *duplicateValidator) validate() {
	duplicates := c.getDuplicates()

	c.logWarnings(duplicates)
	c.takeAwayWritePermissions(duplicates)
}

func keysToSlice(data map[string]struct{}) []string {
	entries := make([]string, 0, len(data))

	for entry := range data {
		entries = append(entries, entry)
	}

	return entries
}
