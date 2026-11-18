package notifier

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier/notifiertest"

	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	"github.com/prometheus/alertmanager/flushlog/flushlogpb"
	"github.com/prometheus/alertmanager/nflog/nflogpb"
	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

var errInvalidState = fmt.Errorf("invalid state")

// silenceState copied from state in prometheus-alertmanager/silence/silence.go.
type silenceState map[string]*silencepb.MeshSilence

// MarshalBinary copied from prometheus-alertmanager/silence/silence.go.
func (s silenceState) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer

	for _, e := range s {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

// decodeSilenceState copied from decodeState in prometheus-alertmanager/silence/silence.go.
func decodeSilenceState(r io.Reader) (silenceState, error) {
	st := silenceState{}
	for {
		var s silencepb.MeshSilence
		_, err := pbutil.ReadDelimited(r, &s)
		if err == nil {
			if s.Silence == nil {
				return nil, errInvalidState
			}
			st[s.Silence.Id] = &s
			continue
		}
		//nolint:errorlint
		if err == io.EOF {
			break
		}
		return nil, err
	}
	return st, nil
}

func createSilence(id string, startsAt, expiresAt time.Time) *silencepb.MeshSilence {
	return &silencepb.MeshSilence{
		Silence: &silencepb.Silence{
			Id: id,
			Matchers: []*silencepb.Matcher{
				{
					Type:    silencepb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: "test_alert",
				},
				{
					Type:    silencepb.Matcher_EQUAL,
					Name:    models.FolderTitleLabel,
					Pattern: "test_alert_folder",
				},
			},
			StartsAt:  startsAt,
			EndsAt:    expiresAt,
			CreatedBy: "Grafana Test",
			Comment:   "Test Silence",
		},
		ExpiresAt: expiresAt,
	}
}

// receiverKey copied from prometheus-alertmanager/nflog/nflog.go.
func receiverKey(r *nflogpb.Receiver) string {
	return fmt.Sprintf("%s/%s/%d", r.GroupName, r.Integration, r.Idx)
}

// stateKey copied from prometheus-alertmanager/nflog/nflog.go.
func stateKey(k string, r *nflogpb.Receiver) string {
	return fmt.Sprintf("%s:%s", k, receiverKey(r))
}

// nflogState copied from state in prometheus-alertmanager/nflog/nflog.go.
type nflogState map[string]*nflogpb.MeshEntry

// MarshalBinary copied from prometheus-alertmanager/nflog/nflog.go.
func (s nflogState) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer

	for _, e := range s {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

// decodeNflogState copied from decodeState in prometheus-alertmanager/nflog/nflog.go.
func decodeNflogState(r io.Reader) (nflogState, error) {
	st := nflogState{}
	for {
		var e nflogpb.MeshEntry
		_, err := pbutil.ReadDelimited(r, &e)
		if err == nil {
			if e.Entry == nil || e.Entry.Receiver == nil {
				return nil, errInvalidState
			}
			st[stateKey(string(e.Entry.GroupKey), e.Entry.Receiver)] = &e
			continue
		}
		if errors.Is(err, io.EOF) {
			break
		}
		return nil, err
	}
	return st, nil
}

func createNotificationLog(groupKey string, receiverName string, sentAt, expiresAt time.Time) (string, *nflogpb.MeshEntry) {
	recv := nflogpb.Receiver{GroupName: receiverName, Integration: "test3", Idx: 0}
	return stateKey(groupKey, &recv), &nflogpb.MeshEntry{
		Entry: &nflogpb.Entry{
			GroupKey:  []byte(groupKey),
			Receiver:  &recv,
			Resolved:  false,
			Timestamp: sentAt,
		},
		ExpiresAt: expiresAt,
	}
}

// https://github.com/grafana/prometheus-alertmanager/blob/main/flushlog/flushlog.go#L136-L136
type flushLogState map[uint64]*flushlogpb.MeshFlushLog

func (s flushLogState) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer

	for _, e := range s {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

func createFlushLog(groupFingerprint uint64, ts, expiresAt time.Time) *flushlogpb.MeshFlushLog {
	return &flushlogpb.MeshFlushLog{
		FlushLog: &flushlogpb.FlushLog{
			GroupFingerprint: groupFingerprint,
			Timestamp:        ts,
		},
		ExpiresAt: expiresAt,
	}
}

// decodeFlushLogState copied from decodeState in prometheus-alertmanager/flushlog/flushlog.go
func decodeFlushLogState(r io.Reader) (flushLogState, error) {
	st := flushLogState{}
	for {
		var e flushlogpb.MeshFlushLog
		_, err := pbutil.ReadDelimited(r, &e)
		if err == nil {
			if e.FlushLog == nil || e.FlushLog.GroupFingerprint == 0 || e.FlushLog.Timestamp.IsZero() {
				return nil, errInvalidState
			}
			st[e.FlushLog.GroupFingerprint] = &e
			continue
		}
		if errors.Is(err, io.EOF) {
			break
		}
		return nil, err
	}
	return st, nil
}

type call struct {
	Method string
	Args   []interface{}
}

type fakeAlertRuleNotificationStore struct {
	Calls []call

	RenameReceiverInNotificationSettingsFn func(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error)
	ListContactPointRoutingsFn             func(ctx context.Context, q models.ListContactPointRoutingsQuery) (map[models.AlertRuleKey]models.ContactPointRouting, error)
}

func (f *fakeAlertRuleNotificationStore) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
	call := call{
		Method: "RenameReceiverInNotificationSettings",
		Args:   []interface{}{ctx, orgID, oldReceiver, newReceiver, validateProvenance, dryRun},
	}
	f.Calls = append(f.Calls, call)

	if f.RenameReceiverInNotificationSettingsFn != nil {
		return f.RenameReceiverInNotificationSettingsFn(ctx, orgID, oldReceiver, newReceiver, validateProvenance, dryRun)
	}

	// Default values when no function hook is provided
	return nil, nil, nil
}

func (f *fakeAlertRuleNotificationStore) ListContactPointRoutings(ctx context.Context, q models.ListContactPointRoutingsQuery) (map[models.AlertRuleKey]models.ContactPointRouting, error) {
	call := call{
		Method: "ListContactPointRoutings",
		Args:   []interface{}{ctx, q},
	}
	f.Calls = append(f.Calls, call)

	if f.ListContactPointRoutingsFn != nil {
		return f.ListContactPointRoutingsFn(ctx, q)
	}

	// Default values when no function hook is provided
	return nil, nil
}

type FakeAlertmanagerProvider struct {
	Calls struct {
		AlertmanagerFor []AlertmanagerForCall
	}
	AlertmanagerForFunc func(orgID int64) (Alertmanager, error)
}

type AlertmanagerForCall struct {
	OrgID int64
}

func (f *FakeAlertmanagerProvider) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	f.Calls.AlertmanagerFor = append(f.Calls.AlertmanagerFor, AlertmanagerForCall{OrgID: orgID})
	if f.AlertmanagerForFunc != nil {
		return f.AlertmanagerForFunc(orgID)
	}
	return nil, ErrNoAlertmanagerForOrg
}

type FakeReceiverService struct {
	Calls struct {
		GetReceiver []GetReceiverCall
	}
	GetReceiverFunc func(ctx context.Context, uid string, decrypt bool, user identity.Requester) (*models.Receiver, error)
}

type GetReceiverCall struct {
	Ctx     context.Context
	UID     string
	Decrypt bool
	User    identity.Requester
}

func (f *FakeReceiverService) GetReceiver(ctx context.Context, uid string, decrypt bool, user identity.Requester) (*models.Receiver, error) {
	f.Calls.GetReceiver = append(f.Calls.GetReceiver, GetReceiverCall{
		Ctx:     ctx,
		UID:     uid,
		Decrypt: decrypt,
		User:    user,
	})
	if f.GetReceiverFunc != nil {
		return f.GetReceiverFunc(ctx, uid, decrypt, user)
	}
	return nil, models.ErrReceiverNotFound.Errorf("")
}

func newTestMultiOrgAlertmanager(t *testing.T, features featuremgmt.FeatureToggles, configStore AlertingStore) *MultiOrgAlertmanager {
	t.Helper()
	env := notifiertest.NewEnvironment(t, []int64{1}, map[int64]struct{}{}, nil)
	if configStore == nil {
		configStore = notifiertest.NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
	}
	cfg := env.Settings
	m := env.Metrics.GetMultiOrgAlertmanagerMetrics()
	logger := log.New("testlogger")
	moa, err := NewMultiOrgAlertmanager(
		cfg, configStore, env.OrgStore, env.KVStore,
		fakes.NewFakeProvisioningStore(), env.SecretsService.GetDecryptedValue,
		m, nil, fakes.NewFakeReceiverPermissionsService(), fakes.NewFakeRoutePermissionsService(),
		logger, env.SecretsService, features, nil, false,
		NewExternalAMSyncer(nil, nil, cfg, m, logger, nil, nil, nil),
	)
	require.NoError(t, err)
	require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(t.Context()))
	return moa
}
