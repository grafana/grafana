package validator

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
)

func TestValidateKeeper(t *testing.T) {
	validator := ProvideKeeperValidator()

	t.Run("when creating a new keeper", func(t *testing.T) {
		t.Run("the `description` must be present", func(t *testing.T) {
			keeper := &secretv1beta1.Keeper{
				Spec: secretv1beta1.KeeperSpec{
					Aws: &secretv1beta1.KeeperAWSConfig{
						AccessKeyID:     secretv1beta1.KeeperCredentialValue{ValueFromEnv: "some-value"},
						SecretAccessKey: secretv1beta1.KeeperCredentialValue{ValueFromEnv: "some-value"},
						KmsKeyID:        ptr.To("kms-key-id"),
					},
				},
			}

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.description", errs[0].Field)
		})
	})

	t.Run("only one `keeper` must be present", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description:    "short description",
				Aws:            &secretv1beta1.KeeperAWSConfig{},
				Azure:          &secretv1beta1.KeeperAzureConfig{},
				Gcp:            &secretv1beta1.KeeperGCPConfig{},
				HashiCorpVault: &secretv1beta1.KeeperHashiCorpConfig{},
			},
		}

		errs := validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec", errs[0].Field)
	})

	t.Run("at least one `keeper` must be present", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
			},
		}

		errs := validator.Validate(keeper, nil, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec", errs[0].Field)
	})

	t.Run("aws keeper validation", func(t *testing.T) {
		validKeeperAWS := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws: &secretv1beta1.KeeperAWSConfig{
					AccessKeyID: secretv1beta1.KeeperCredentialValue{
						ValueFromEnv: "some-value",
					},
					SecretAccessKey: secretv1beta1.KeeperCredentialValue{
						SecureValueName: "some-value",
					},
					KmsKeyID: ptr.To("optional"),
				},
			},
		}

		t.Run("`accessKeyID` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.Aws.AccessKeyID = secretv1beta1.KeeperCredentialValue{}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.accessKeyID", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.Aws.AccessKeyID = secretv1beta1.KeeperCredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.accessKeyID", errs[0].Field)
			})
		})

		t.Run("`secretAccessKey` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.Aws.SecretAccessKey = secretv1beta1.KeeperCredentialValue{}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.secretAccessKey", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.Aws.SecretAccessKey = secretv1beta1.KeeperCredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.secretAccessKey", errs[0].Field)
			})
		})
	})

	t.Run("azure keeper validation", func(t *testing.T) {
		validKeeperAzure := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Azure: &secretv1beta1.KeeperAzureConfig{
					KeyVaultName: "kv-name",
					TenantID:     "tenant-id",
					ClientID:     "client-id",
					ClientSecret: secretv1beta1.KeeperCredentialValue{
						ValueFromConfig: "config.path.value",
					},
				},
			},
		}

		t.Run("`keyVaultName` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.KeyVaultName = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.keyVaultName", errs[0].Field)
		})

		t.Run("`tenantID` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.TenantID = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.tenantID", errs[0].Field)
		})

		t.Run("`clientID` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.ClientID = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.clientID", errs[0].Field)
		})

		t.Run("`clientSecret` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAzure.DeepCopy()
				keeper.Spec.Azure.ClientSecret = secretv1beta1.KeeperCredentialValue{}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.azure.clientSecret", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAzure.DeepCopy()
				keeper.Spec.Azure.ClientSecret = secretv1beta1.KeeperCredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.azure.clientSecret", errs[0].Field)
			})
		})
	})

	t.Run("gcp keeper validation", func(t *testing.T) {
		validKeeperGCP := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Gcp: &secretv1beta1.KeeperGCPConfig{
					ProjectID:       "project-id",
					CredentialsFile: "/path/to/credentials/file.json",
				},
			},
		}

		t.Run("`projectID` must be present", func(t *testing.T) {
			keeper := validKeeperGCP.DeepCopy()
			keeper.Spec.Gcp.ProjectID = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.gcp.projectID", errs[0].Field)
		})

		t.Run("`credentialsFile` must be present", func(t *testing.T) {
			keeper := validKeeperGCP.DeepCopy()
			keeper.Spec.Gcp.CredentialsFile = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.gcp.credentialsFile", errs[0].Field)
		})
	})

	t.Run("hashicorp keeper validation", func(t *testing.T) {
		validKeeperHashiCorp := &secretv1beta1.Keeper{
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				HashiCorpVault: &secretv1beta1.KeeperHashiCorpConfig{
					Address: "http://address",
					Token: secretv1beta1.KeeperCredentialValue{
						ValueFromConfig: "config.path.value",
					},
				},
			},
		}

		t.Run("`address` must be present", func(t *testing.T) {
			keeper := validKeeperHashiCorp.DeepCopy()
			keeper.Spec.HashiCorpVault.Address = ""

			errs := validator.Validate(keeper, nil, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.hashiCorpVault.address", errs[0].Field)
		})

		t.Run("`token` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperHashiCorp.DeepCopy()
				keeper.Spec.HashiCorpVault.Token = secretv1beta1.KeeperCredentialValue{}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.hashiCorpVault.token", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperHashiCorp.DeepCopy()
				keeper.Spec.HashiCorpVault.Token = secretv1beta1.KeeperCredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := validator.Validate(keeper, nil, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.hashiCorpVault.token", errs[0].Field)
			})
		})
	})
}
