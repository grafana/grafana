package validator

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestValidateKeeper(t *testing.T) {
	objectMeta := metav1.ObjectMeta{Name: "test", Namespace: "test"}
	validator := ProvideKeeperValidator(featuremgmt.WithFeatures(featuremgmt.FlagSecretsManagementAppPlatformAwsKeeper))

	t.Run("when creating a new keeper", func(t *testing.T) {
		t.Run("the `description` must be present", func(t *testing.T) {
			keeper := &secretv1beta1.Keeper{
				ObjectMeta: objectMeta,
				Spec: secretv1beta1.KeeperSpec{
					Aws: &secretv1beta1.KeeperAWSConfig{
						Region: "us-east-1",
						AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
							AssumeRoleArn: "arn",
							ExternalID:    "id",
						},
					},
				},
			}

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.description", errs[0].Field)
		})
	})

	t.Run("aws keeper validation", func(t *testing.T) {
		validKeeperAWS := &secretv1beta1.Keeper{
			ObjectMeta: objectMeta,
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws: &secretv1beta1.KeeperAWSConfig{
					Region: "us-east-1",
					AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
						AssumeRoleArn: "arn",
						ExternalID:    "id",
					},
				},
			},
		}

		errs := validator.Validate(validKeeperAWS, nil, admission.Create)
		require.Len(t, errs, 0)

		t.Run("aws keeper feature flag must be enabled", func(t *testing.T) {
			// Validator with feature disabled
			validator := ProvideKeeperValidator(featuremgmt.WithFeatures())
			errs := validator.Validate(validKeeperAWS.DeepCopy(), nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.aws", errs[0].Field)
			require.Contains(t, errs[0].Detail, "secretsManagementAppPlatformAwsKeeper")
		})

		t.Run("assumeRole must be present", func(t *testing.T) {
			keeper := validKeeperAWS.DeepCopy()
			keeper.Spec.Aws.AssumeRole = nil

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.aws", errs[0].Field)
			require.Equal(t, "`assumeRole` must be present", errs[0].Detail)
		})
	})

	t.Run("invalid name", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: objectMeta.Namespace,
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws: &secretv1beta1.KeeperAWSConfig{
					Region: "us-east-1",
					AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
						AssumeRoleArn: "arn",
						ExternalID:    "id",
					},
				},
			},
		}

		keeper.Name = ""
		errs := validator.Validate(keeper, nil, admission.Delete)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.name", errs[0].Field)

		keeper.Name = "invalid/name-"
		errs = validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.name", errs[0].Field)

		keeper.Name = strings.Repeat("a", 253+1)
		errs = validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.name", errs[0].Field)
	})

	t.Run("invalid namespace", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name: objectMeta.Name,
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws: &secretv1beta1.KeeperAWSConfig{
					Region: "us-east-1",
					AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
						AssumeRoleArn: "arn",
						ExternalID:    "id",
					},
				},
			},
		}

		keeper.Namespace = ""
		errs := validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.namespace", errs[0].Field)

		keeper.Namespace = "invalid/namespace-"
		errs = validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.namespace", errs[0].Field)

		keeper.Namespace = strings.Repeat("a", 253+1)
		errs = validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "metadata.namespace", errs[0].Field)
	})

	t.Run("keeper name `system` is reserved", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "system",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws: &secretv1beta1.KeeperAWSConfig{
					Region: "us-east-1",
					AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
						AssumeRoleArn: "arn",
						ExternalID:    "id",
					},
				},
			},
		}

		errs := validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "name", errs[0].Field)
		require.Equal(t, "the keeper name `system` is reserved", errs[0].Detail)
	})
}
