package login

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type LoginStats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
	MixedCasedUsers      int `xorm:"mixed_cased_users"`
}

const (
	ExporterName              = "grafana"
	MetricsCollectionInterval = time.Second * 60 * 4 // every 4 hours, indication of duplicate users
)

var (
	// MStatDuplicateUserEntries is a indication metric gauge for number of users with duplicate emails or logins
	MStatDuplicateUserEntries prometheus.Gauge

	// MStatHasDuplicateEntries is a metric for if there is duplicate users
	MStatHasDuplicateEntries prometheus.Gauge

	// MStatMixedCasedUsers is a metric for if there is duplicate users
	MStatMixedCasedUsers prometheus.Gauge

	Once        sync.Once
	Initialised bool = false
)
