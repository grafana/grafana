package migrator

import (
	"fmt"
	"strings"
	"time"

	claims "github.com/grafana/authlib/types"
)

const legacyNamePrefix = "legacy-"

type LegacyAnnotation struct {
	ID                   int64
	Epoch                int64
	EpochEnd             int64
	DashboardUID         string
	PanelID              int64
	Text                 string
	Data                 string
	Created              int64
	Updated              int64
	UserUID              string
	UserIsServiceAccount bool
	Tags                 []string
}

// legacyNamePrefix is prepended to the legacy numeric ID
// The name is deterministic so that re-running a migration
// produces the same primary key (namespace, name, time)
func legacyName(id int64) string {
	return fmt.Sprintf("%s%d", legacyNamePrefix, id)
}

// toBackfillRecord converts a legacy annotation into a destination record for
// the given namespace, applying the sanitization rules required by the new schema
func toBackfillRecord(namespace string, a LegacyAnnotation) BackfillRecord {
	rec := BackfillRecord{
		Namespace: namespace,
		Name:      legacyName(a.ID),
		Time:      a.Epoch,
		Text:      a.Text,
		Tags:      a.Tags,
		LegacyID:  a.ID,
	}

	if a.EpochEnd > a.Epoch {
		end := a.EpochEnd
		rec.TimeEnd = &end
	}

	// Match the live write path, which stores the typed identifier
	// (e.g. "user:<uid>" or "service-account:<uid>") via Requester.GetUID().
	if a.UserUID != "" {
		idType := claims.TypeUser
		if a.UserIsServiceAccount {
			idType = claims.TypeServiceAccount
		}
		rec.CreatedBy = claims.NewTypeID(idType, a.UserUID)
	}

	if a.DashboardUID != "" {
		uid := a.DashboardUID
		rec.DashboardUID = &uid
	}

	if a.PanelID > 0 {
		pid := a.PanelID
		rec.PanelID = &pid
	}

	createdAtMs := a.Created
	if createdAtMs == 0 {
		createdAtMs = a.Epoch
	}
	rec.CreatedAt = time.UnixMilli(createdAtMs).UTC()

	if data := cleanLegacyData(a.Data); data != "" {
		rec.LegacyData = &data
	}

	return rec
}

// cleanLegacyData returns the legacy data JSON to preserve, or "" if it carries
// no meaningful payload.
func cleanLegacyData(data string) string {
	trimmed := strings.TrimSpace(data)
	switch trimmed {
	case "", "{}", "[]", "null":
		return ""
	default:
		return trimmed
	}
}
