package schedule

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"time"
	"unsafe"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// retryDelay represents how long to wait between each failed rule evaluation.
const retryDelay = 1 * time.Second

type fingerprint uint64

func (f fingerprint) String() string {
	return fmt.Sprintf("%016x", uint64(f))
}

// fingerprintSeparator used during calculation of fingerprint to separate different fields. Contains a byte sequence that cannot happen in UTF-8 strings.
var fingerprintSeparator = []byte{255}

// AlertsSender is an interface for a service that is responsible for sending notifications to the end-user.
//
//go:generate mockery --name AlertsSender --structname AlertsSenderMock --inpackage --filename alerts_sender_mock.go --with-expecter
type AlertsSender interface {
	Send(ctx context.Context, key models.AlertRuleKey, alerts definitions.PostableAlerts)
}

type RecordingWriter interface {
	Write(ctx context.Context, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error
}

// ScheduleService is an interface for a service that schedules the evaluation
// of alert rules.
type ScheduleService interface {
	// Run the scheduler until the context is canceled or the scheduler returns
	// an error. The scheduler is terminated when this function returns.
	Run(context.Context) error
}

// RulesStore is a store that provides alert rules for scheduling
type RulesStore interface {
	GetAlertRulesKeysForScheduling(ctx context.Context) ([]models.AlertRuleKeyWithVersion, error)
	GetAlertRulesForScheduling(ctx context.Context, query *models.GetAlertRulesForSchedulingQuery) error
}

func SchedulerUserFor(orgID int64) *user.SignedInUser {
	return &user.SignedInUser{
		UserID:           -1,
		IsServiceAccount: true,
		Login:            "grafana_scheduler",
		OrgID:            orgID,
		OrgRole:          org.RoleAdmin,
		Permissions: map[int64]map[string][]string{
			orgID: {
				datasources.ActionQuery: []string{
					datasources.ScopeAll,
				},
			},
		},
	}
}

type Evaluation struct {
	scheduledAt time.Time
	rule        *models.AlertRule
	folderTitle string
}

func (e *Evaluation) Fingerprint() fingerprint {
	return ruleWithFolder{e.rule, e.folderTitle}.Fingerprint()
}

// hashRule calculates a hash for the rule. This hash is used to determine if the rule has changed.
// Since we don't care about the namespace/folder title for this purpose, we can skip encoding it
func hashRule(rule *models.AlertRule) fingerprint {
	return buildFingerprint(rule, "")
}

type ruleWithFolder struct {
	rule        *models.AlertRule
	folderTitle string
}

func (r ruleWithFolder) Fingerprint() fingerprint {
	return buildFingerprint(r.rule, r.folderTitle)
}

// buildFingerprint calculates a fingerprint that includes all fields except rule's Version and Update timestamp,
// as well as an optional folder title.
func buildFingerprint(rule *models.AlertRule, folderTitle string) fingerprint {
	sum := fnv.New64()

	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(fingerprintSeparator)
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}
	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int64) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}

	// allocate a slice that will be used for sorting keys, so we allocate it only once
	var keys []string
	maxLen := int(math.Max(math.Max(float64(len(rule.Annotations)), float64(len(rule.Labels))), float64(len(rule.Data))))
	if maxLen > 0 {
		keys = make([]string, maxLen)
	}

	writeLabels := func(lbls map[string]string) {
		// maps do not guarantee predictable sequence of keys.
		// Therefore, to make hash stable, we need to sort keys
		if len(lbls) == 0 {
			return
		}
		idx := 0
		for labelName := range lbls {
			keys[idx] = labelName
			idx++
		}
		sub := keys[:idx]
		sort.Strings(sub)
		for _, name := range sub {
			writeString(name)
			writeString(lbls[name])
		}
	}
	writeQuery := func() {
		// The order of queries is not important as they represent an expression tree.
		// Therefore, the order of elements should not change the hash. Sort by RefID because it is the unique key.
		for i, q := range rule.Data {
			keys[i] = q.RefID
		}
		sub := keys[:len(rule.Data)]
		sort.Strings(sub)
		for _, id := range sub {
			for _, q := range rule.Data {
				if q.RefID == id {
					writeString(q.RefID)
					writeString(q.DatasourceUID)
					writeString(q.QueryType)
					writeInt(int64(q.RelativeTimeRange.From))
					writeInt(int64(q.RelativeTimeRange.To))
					writeBytes(q.Model)
					break
				}
			}
		}
	}

	// fields that determine the rule state
	writeString(rule.UID)
	writeString(rule.Title)
	writeString(rule.NamespaceUID)
	if folderTitle != "" {
		writeString(folderTitle)
	}
	writeLabels(rule.Labels)
	writeString(rule.Condition)
	writeQuery()

	if rule.IsPaused {
		writeInt(1)
	} else {
		writeInt(0)
	}

	for _, setting := range rule.NotificationSettings {
		binary.LittleEndian.PutUint64(tmp, uint64(setting.Fingerprint()))
		writeBytes(tmp)
	}

	// fields that do not affect the state.
	// TODO consider removing fields below from the fingerprint
	// writeInt(rule.ID) <-- candidate for removal
	writeInt(rule.OrgID)
	writeInt(int64(rule.For))
	if rule.DashboardUID != nil {
		writeString(*rule.DashboardUID)
	}
	if rule.PanelID != nil {
		writeInt(*rule.PanelID)
	}
	// writeString(rule.RuleGroup) <-- candidate for removal, we already grouped the rules
	// writeInt(int64(rule.RuleGroupIndex)) <-- candidate for removal, we already grouped the rules
	writeString(string(rule.NoDataState))
	writeString(string(rule.ExecErrState))
	if rule.Record != nil {
		binary.LittleEndian.PutUint64(tmp, uint64(rule.Record.Fingerprint()))
		writeBytes(tmp)
	}

	return fingerprint(sum.Sum64())
}
