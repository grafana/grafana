package multiorgtest

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/notifiertest"

	"github.com/stretchr/testify/require"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
)

type RejectingValidation struct{}

func (n RejectingValidation) Config() *v1.AMConfigV1 {
	return nil
}

func (n RejectingValidation) Validate(s models.NotificationSettings) error {
	return notifier.ErrorReceiverDoesNotExist{ErrorReferenceInvalid: notifier.ErrorReferenceInvalid{Reference: s.ContactPointRouting.Receiver}}
}

type TestMultiOrgAlertmanagerOptions struct {
	orgs           []int64
	configs        map[int64]*models.AlertConfiguration
	disabledOrgs   map[int64]struct{}
	featureToggles featuremgmt.FeatureToggles
	peer           alertingNotify.ClusterPeer
	waitReady      bool
	secretService  *secretsManager.SecretsService //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	alertmanagers  map[int64]notifier.Alertmanager
	cfgStore       notifier.AlertingStore
	skipLoad       bool
}

type TestMultiOrgAlertmanagerOption func(*TestMultiOrgAlertmanagerOptions)

func WithOrgs(orgs []int64) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.orgs = orgs
	}
}

func WithConfigs(configs map[int64]*models.AlertConfiguration) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.configs = configs
	}
}

func WithDisabledOrgs(disabledOrgs map[int64]struct{}) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.disabledOrgs = disabledOrgs
	}
}

func WithFeatureToggles(ft featuremgmt.FeatureToggles) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.featureToggles = ft
	}
}

func WithPeer(peer alertingNotify.ClusterPeer) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.peer = peer
	}
}

func WithWaitReady() TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.waitReady = true
	}
}

func WithSecretService(
	secretService *secretsManager.SecretsService, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.secretService = secretService
	}
}

func WithAlertmanagers(alertmanagers map[int64]notifier.Alertmanager) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.alertmanagers = alertmanagers
	}
}

func WithConfigStore(cfgStore notifier.AlertingStore) TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.cfgStore = cfgStore
	}
}

func WithSkipLoad() TestMultiOrgAlertmanagerOption {
	return func(opts *TestMultiOrgAlertmanagerOptions) {
		opts.skipLoad = true
	}
}

func NewTestMultiOrgAlertmanager(t *testing.T, opts ...TestMultiOrgAlertmanagerOption) *notifier.MultiOrgAlertmanager {
	t.Helper()

	options := TestMultiOrgAlertmanagerOptions{
		orgs:           []int64{1},
		configs:        make(map[int64]*models.AlertConfiguration),
		disabledOrgs:   map[int64]struct{}{},
		featureToggles: featuremgmt.WithFeatures(),
		waitReady:      false,
	}
	for _, opt := range opts {
		opt(&options)
	}

	env := notifiertest.NewEnvironment(t, options.orgs, options.disabledOrgs, options.secretService)
	cfg := env.Settings
	secretsService := env.SecretsService
	m := env.Metrics
	cfgStore := options.cfgStore
	if cfgStore == nil {
		cfgStore = notifiertest.NewFakeConfigStore(t, options.configs)
	}

	var moaOpts []notifier.Option
	if options.peer != nil {
		moaOpts = append(moaOpts, notifier.WithClusterPeer(options.peer))
	}

	if options.alertmanagers != nil {
		moaOpts = append(moaOpts, notifier.WithInitialAlertmanagers(options.alertmanagers))
	}
	moa, err := notifier.NewMultiOrgAlertmanager(
		cfg,
		cfgStore,
		env.OrgStore,
		env.KVStore,
		fakes.NewFakeProvisioningStore(),
		secretsService.GetDecryptedValue,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		fakes.NewFakeReceiverPermissionsService(),
		fakes.NewFakeRoutePermissionsService(),
		log.New("testlogger"),
		secretsService,
		options.featureToggles,
		nil,
		false,
		// Sync deps are nil — tests do not enable the sync feature flag.
		notifier.NewExternalAMSyncer(nil, nil, cfg, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"), nil, nil, nil),
		moaOpts...,
	)
	require.NoError(t, err)

	if !options.skipLoad {
		require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(context.Background()))
	}

	if options.waitReady {
		require.Eventually(t, func() bool {
			for _, org := range options.orgs {
				_, err := moa.AlertmanagerFor(org)
				if err != nil {
					return false
				}
			}
			return true
		}, 10*time.Second, 100*time.Millisecond)
	}

	return moa
}
