package provisioning

import (
	"context"
	"errors"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

// recordingValidator records, in order, what happens to notification settings.
type recordingValidator struct {
	events *[]string
	err    error
}

func (v recordingValidator) Validate(models.NotificationSettings) error {
	*v.events = append(*v.events, "validate")
	return v.err
}

// validatedAgainst is the configuration that recordingValidator validates against.
var validatedAgainst = &v1.AMConfigV1{Receivers: v1.ReceiversFromSlice([]*v1.PostableApiReceiver{
	{ResourceMetadata: v1.ResourceMetadata{UID: "uid-of-receiver"}, Name: "receiver"},
	{ResourceMetadata: v1.ResourceMetadata{UID: "uid-of-other"}, Name: "other"},
})}

func (v recordingValidator) Config() *v1.AMConfigV1 {
	return validatedAgainst
}

type recordingValidatorProvider struct {
	validator notifier.NotificationSettingsValidator
	lookups   int
}

func (p *recordingValidatorProvider) Validator(context.Context, int64) (notifier.NotificationSettingsValidator, error) {
	p.lookups++
	return p.validator, nil
}

func TestAlertRuleService_CreateAlertRuleAuthorizesNotificationSettings(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID, UserUID: util.GenerateShortUID()}
	gen := models.RuleGen
	newRule := func() models.AlertRule {
		return gen.With(
			gen.WithOrgID(orgID),
			gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver"))),
		).Generate()
	}

	t.Run("when user cannot write all rules", func(t *testing.T) {
		service, _, _, ac := initService(t)
		service.nsValidatorProvider = &recordingValidatorProvider{validator: recordingValidator{events: &[]string{}}}
		var authorized []accesscontrol.ReceiverRef
		ac.AuthorizeNotificationSettingsFunc = func(_ context.Context, _ identity.Requester, receivers []accesscontrol.ReceiverRef) error {
			authorized = receivers
			return nil
		}
		rule := newRule()
		_, err := service.CreateAlertRule(context.Background(), u, rule, models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.NoError(t, err)
		require.Equal(t, []accesscontrol.ReceiverRef{{UID: "uid-of-receiver"}}, authorized)
	})

	t.Run("it should not insert if not authorized to use the receiver", func(t *testing.T) {
		service, ruleStore, _, ac := initService(t)
		denied := errors.New("denied")
		ac.AuthorizeNotificationSettingsFunc = func(context.Context, identity.Requester, []accesscontrol.ReceiverRef) error {
			return denied
		}
		_, err := service.CreateAlertRule(context.Background(), u, newRule(), models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.ErrorIs(t, err, denied)
		inserts := ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
			a, ok := cmd.([]models.InsertRule)
			return a, ok
		})
		require.Empty(t, inserts)
	})

	t.Run("it authorizes the receiver, with the configuration it validates against, before validating", func(t *testing.T) {
		service, _, _, ac := initService(t)
		events := &[]string{}
		provider := &recordingValidatorProvider{validator: recordingValidator{events: events}}
		service.nsValidatorProvider = provider
		ac.AuthorizeNotificationSettingsFunc = func(_ context.Context, _ identity.Requester, receivers []accesscontrol.ReceiverRef) error {
			require.Len(t, receivers, 1)
			*events = append(*events, "authorize "+receivers[0].UID)
			return nil
		}
		_, err := service.CreateAlertRule(context.Background(), u, newRule(), models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.NoError(t, err)
		assert.Equal(t, []string{"authorize uid-of-receiver", "validate"}, *events)
		assert.Equal(t, 1, provider.lookups, "the configuration should only be loaded once")
	})

	t.Run("it does not validate what the user is not authorized to use", func(t *testing.T) {
		service, _, _, ac := initService(t)
		events := &[]string{}
		service.nsValidatorProvider = &recordingValidatorProvider{validator: recordingValidator{events: events}}
		ac.AuthorizeNotificationSettingsFunc = func(context.Context, identity.Requester, []accesscontrol.ReceiverRef) error {
			return errors.New("denied")
		}
		_, err := service.CreateAlertRule(context.Background(), u, newRule(), models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.Error(t, err)
		assert.Empty(t, *events)
	})

	t.Run("it returns validation errors as such", func(t *testing.T) {
		service, _, _, _ := initService(t)
		failure := errors.New("receiver does not exist")
		service.nsValidatorProvider = &recordingValidatorProvider{validator: recordingValidator{events: &[]string{}, err: failure}}
		_, err := service.CreateAlertRule(context.Background(), u, newRule(), models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
		require.ErrorIs(t, err, failure)
	})

	t.Run("when user can write all rules", func(t *testing.T) {
		service, _, _, ac := initService(t)
		ac.CanWriteAllRulesFunc = func(context.Context, identity.Requester) (bool, error) { return true, nil }
		ac.AuthorizeNotificationSettingsFunc = func(context.Context, identity.Requester, []accesscontrol.ReceiverRef) error {
			t.Fatal("receivers should not be authorized for users that can write all rules")
			return nil
		}
		_, err := service.CreateAlertRule(context.Background(), u, newRule(), models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.NoError(t, err)
	})
}

func TestAlertRuleService_UpdateAlertRuleAuthorizesChangedNotificationSettings(t *testing.T) {
	orgID := rand.Int63()
	u := &user.SignedInUser{OrgID: orgID}
	groupKey := models.GenerateGroupKey(orgID)
	gen := models.RuleGen
	rules := gen.With(
		gen.WithGroupKey(groupKey),
		gen.WithIntervalSeconds(30),
		gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver"))),
	).GenerateManyRef(3)

	setup := func(t *testing.T) (*AlertRuleService, *[]string) {
		service, ruleStore, provenanceStore, ac := initService(t)
		ruleStore.Rules = map[int64][]*models.AlertRule{orgID: rules}
		for _, rule := range rules {
			require.NoError(t, provenanceStore.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI))
		}
		events := &[]string{}
		service.nsValidatorProvider = &recordingValidatorProvider{validator: recordingValidator{events: events}}
		ac.AuthorizeNotificationSettingsFunc = func(_ context.Context, _ identity.Requester, receivers []accesscontrol.ReceiverRef) error {
			require.Len(t, receivers, 1)
			*events = append(*events, "authorize "+receivers[0].UID)
			return nil
		}
		return service, events
	}

	t.Run("it authorizes the receiver of settings that changed before validating them", func(t *testing.T) {
		service, events := setup(t)
		rule := models.CopyRule(rules[0])
		rule.NotificationSettings.ContactPointRouting.Receiver = "other"

		_, err := service.UpdateAlertRule(context.Background(), u, *rule, models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.NoError(t, err)
		assert.Equal(t, []string{"authorize uid-of-other", "validate"}, *events)
	})

	t.Run("it does not authorize the receiver of settings that did not change but still validates them", func(t *testing.T) {
		service, events := setup(t)
		rule := models.CopyRule(rules[0])
		rule.Title += "_new"

		_, err := service.UpdateAlertRule(context.Background(), u, *rule, models.ProvenanceToManagerProperties(models.ProvenanceAPI))
		require.NoError(t, err)
		assert.Equal(t, []string{"validate"}, *events)
	})
}
