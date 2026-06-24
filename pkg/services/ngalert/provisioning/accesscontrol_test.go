package provisioning

import (
	"context"
	"errors"
	"math/rand/v2"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestCanReadAllRules(t *testing.T) {
	testUser := &user.SignedInUser{}

	t.Run("should check for provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		expected := rand.Int()%2 == 1
		rs.HasAccessFunc = func(ctx context.Context, requester identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return expected, nil
		}
		p := &provisioningRuleAccessControl{rs}
		res, err := p.CanReadAllRules(context.Background(), testUser)
		require.NoError(t, err)
		require.Equal(t, expected, res)

		require.Len(t, rs.Calls, 1)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		require.Equal(t, accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningRead),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRulesProvisioningRead),
		).GoString(), rs.Calls[0].Arguments[2].(accesscontrol.Evaluator).GoString())
	})

	t.Run("should return error", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		expected := errors.New("test")
		rs.HasAccessFunc = func(ctx context.Context, requester identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, expected
		}
		p := &provisioningRuleAccessControl{rs}
		_, err := p.CanReadAllRules(context.Background(), testUser)
		require.ErrorIs(t, err, expected)
	})
}

func TestCanWriteAllRules(t *testing.T) {
	testUser := &user.SignedInUser{}

	t.Run("should check for provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		expected := rand.Int()%2 == 1
		rs.HasAccessFunc = func(ctx context.Context, requester identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return expected, nil
		}
		p := &provisioningRuleAccessControl{rs}
		res, err := p.CanWriteAllRules(context.Background(), testUser)
		require.NoError(t, err)
		require.Equal(t, expected, res)

		require.Len(t, rs.Calls, 1)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		require.Equal(t,
			accesscontrol.EvalAny(
				accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningWrite),
				accesscontrol.EvalPermission(accesscontrol.ActionAlertingRulesProvisioningWrite),
			).GoString(), rs.Calls[0].Arguments[2].(accesscontrol.Evaluator).GoString())
	})

	t.Run("should return error", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		expected := errors.New("test")
		rs.HasAccessFunc = func(ctx context.Context, requester identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, expected
		}
		p := &provisioningRuleAccessControl{rs}
		_, err := p.CanWriteAllRules(context.Background(), testUser)
		require.ErrorIs(t, err, expected)
	})
}

func TestAuthorizeAccessToRuleGroup(t *testing.T) {
	testUser := &user.SignedInUser{}
	rules := models.RuleGen.GenerateManyRef(1)

	t.Run("should return nil when user has provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return true, nil
		}

		err := provisioner.AuthorizeRuleGroupRead(context.Background(), testUser, rules)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 1)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		assert.Equal(t, accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningRead),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRulesProvisioningRead),
		).GoString(), rs.Calls[0].Arguments[2].(accesscontrol.Evaluator).GoString())
		assert.Equal(t, testUser, rs.Calls[0].Arguments[1])
	})

	t.Run("should call upstream method if no provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		rs.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, requester identity.Requester, group models.RulesGroup) error {
			return nil
		}

		err := provisioner.AuthorizeRuleGroupRead(context.Background(), testUser, rules)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 2)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		require.Equal(t, "AuthorizeRuleGroupRead", rs.Calls[1].MethodName)
		require.Equal(t, models.RulesGroup(rules), rs.Calls[1].Arguments[2])
	})

	t.Run("should propagate error", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		expected := errors.New("test1")
		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, expected
		}

		err := provisioner.AuthorizeRuleGroupRead(context.Background(), testUser, rules)
		require.ErrorIs(t, err, expected)

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		expected = errors.New("test2")
		rs.AuthorizeAccessToRuleGroupFunc = func(ctx context.Context, requester identity.Requester, group models.RulesGroup) error {
			return expected
		}

		err = provisioner.AuthorizeRuleGroupRead(context.Background(), testUser, rules)
		require.ErrorIs(t, err, expected)
	})
}

func TestAuthorizeAccessToRule(t *testing.T) {
	testUser := &user.SignedInUser{}
	rule := models.RuleGen.Generate()

	t.Run("should return nil when user has provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return true, nil
		}

		err := provisioner.AuthorizeRuleRead(context.Background(), testUser, &rule)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 1)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		assert.Equal(t, accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningRead),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRulesProvisioningRead),
		).GoString(), rs.Calls[0].Arguments[2].(accesscontrol.Evaluator).GoString())
		assert.Equal(t, testUser, rs.Calls[0].Arguments[1])
	})

	t.Run("should call upstream method if no provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		rs.AuthorizeAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) error {
			return nil
		}

		err := provisioner.AuthorizeRuleRead(context.Background(), testUser, &rule)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 2)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		require.Equal(t, "AuthorizeAccessInFolder", rs.Calls[1].MethodName)
		require.Equal(t, &rule, rs.Calls[1].Arguments[2])
	})

	t.Run("should propagate error", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		expected := errors.New("test1")
		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, expected
		}

		err := provisioner.AuthorizeRuleRead(context.Background(), testUser, &rule)
		require.ErrorIs(t, err, expected)

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		expected = errors.New("test2")
		rs.AuthorizeAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, rule models.Namespaced) error {
			return expected
		}

		err = provisioner.AuthorizeRuleRead(context.Background(), testUser, &rule)
		require.ErrorIs(t, err, expected)
	})
}

func TestAuthorizeRuleChanges(t *testing.T) {
	testUser := &user.SignedInUser{}
	change := &store.GroupDelta{}

	t.Run("should return nil when user has provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return true, nil
		}

		err := provisioner.AuthorizeRuleGroupWrite(context.Background(), testUser, change)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 1)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		assert.Equal(t, accesscontrol.EvalAny(
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningWrite),
			accesscontrol.EvalPermission(accesscontrol.ActionAlertingRulesProvisioningWrite),
		).GoString(), rs.Calls[0].Arguments[2].(accesscontrol.Evaluator).GoString())
		assert.Equal(t, testUser, rs.Calls[0].Arguments[1])
	})

	t.Run("should call upstream method if no provisioning permissions", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		rs.AuthorizeRuleChangesFunc = func(ctx context.Context, user identity.Requester, delta *store.GroupDelta) error {
			return nil
		}

		err := provisioner.AuthorizeRuleGroupWrite(context.Background(), testUser, change)
		require.NoError(t, err)

		require.Len(t, rs.Calls, 2)
		require.Equal(t, "HasAccess", rs.Calls[0].MethodName)
		require.Equal(t, "AuthorizeRuleGroupWrite", rs.Calls[1].MethodName)
		require.Equal(t, testUser, rs.Calls[1].Arguments[1])
		require.Equal(t, change, rs.Calls[1].Arguments[2])
	})

	t.Run("should propagate error", func(t *testing.T) {
		rs := &fakes.FakeRuleService{}
		provisioner := provisioningRuleAccessControl{
			RuleAccessControlService: rs,
		}

		expected := errors.New("test1")
		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, expected
		}

		err := provisioner.AuthorizeRuleGroupWrite(context.Background(), testUser, change)
		require.ErrorIs(t, err, expected)

		rs.HasAccessFunc = func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}
		expected = errors.New("test2")
		rs.AuthorizeRuleChangesFunc = func(ctx context.Context, requester identity.Requester, delta *store.GroupDelta) error {
			return expected
		}

		err = provisioner.AuthorizeRuleGroupWrite(context.Background(), testUser, change)
		require.ErrorIs(t, err, expected)
	})
}
