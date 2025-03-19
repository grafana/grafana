package reststorage

import (
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
)

func TestValidateKeeper(t *testing.T) {
	t.Run("when creating a new keeper", func(t *testing.T) {
		t.Run("the `title` must be present", func(t *testing.T) {
			keeper := &secretv0alpha1.Keeper{
				Spec: secretv0alpha1.KeeperSpec{
					SQL: &secretv0alpha1.SQLKeeperConfig{},
				},
			}

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.title", errs[0].Field)
		})
	})

	t.Run("only one `keeper` must be present", func(t *testing.T) {
		keeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title:     "title",
				SQL:       &secretv0alpha1.SQLKeeperConfig{},
				AWS:       &secretv0alpha1.AWSKeeperConfig{},
				Azure:     &secretv0alpha1.AzureKeeperConfig{},
				GCP:       &secretv0alpha1.GCPKeeperConfig{},
				HashiCorp: &secretv0alpha1.HashiCorpKeeperConfig{},
			},
		}

		errs := ValidateKeeper(keeper, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec", errs[0].Field)
	})

	t.Run("at least one `keeper` must be present", func(t *testing.T) {
		keeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title: "title",
			},
		}

		errs := ValidateKeeper(keeper, admission.Create)
		require.Len(t, errs, 1)
		require.Equal(t, "spec", errs[0].Field)
	})

	t.Run("aws keeper validation", func(t *testing.T) {
		validKeeperAWS := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title: "title",
				AWS: &secretv0alpha1.AWSKeeperConfig{
					AWSCredentials: secretv0alpha1.AWSCredentials{
						AccessKeyID: secretv0alpha1.CredentialValue{
							ValueFromEnv: "some-value",
						},
						SecretAccessKey: secretv0alpha1.CredentialValue{
							SecureValueName: "some-value",
						},
						KMSKeyID: "optional",
					},
				},
			},
		}

		t.Run("`accessKeyId` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.AWS.AccessKeyID = secretv0alpha1.CredentialValue{}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.accessKeyId", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.AWS.AccessKeyID = secretv0alpha1.CredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.accessKeyId", errs[0].Field)
			})
		})

		t.Run("`secretAccessKey` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.AWS.SecretAccessKey = secretv0alpha1.CredentialValue{}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.secretAccessKey", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAWS.DeepCopy()
				keeper.Spec.AWS.SecretAccessKey = secretv0alpha1.CredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.aws.secretAccessKey", errs[0].Field)
			})
		})
	})

	t.Run("azure keeper validation", func(t *testing.T) {
		validKeeperAzure := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title: "title",
				Azure: &secretv0alpha1.AzureKeeperConfig{
					AzureCredentials: secretv0alpha1.AzureCredentials{
						KeyVaultName: "kv-name",
						TenantID:     "tenant-id",
						ClientID:     "client-id",
						ClientSecret: secretv0alpha1.CredentialValue{
							ValueFromConfig: "config.path.value",
						},
					},
				},
			},
		}

		t.Run("`keyVaultName` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.KeyVaultName = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.keyVaultName", errs[0].Field)
		})

		t.Run("`tenantId` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.TenantID = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.tenantId", errs[0].Field)
		})

		t.Run("`clientId` must be present", func(t *testing.T) {
			keeper := validKeeperAzure.DeepCopy()
			keeper.Spec.Azure.ClientID = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.azure.clientId", errs[0].Field)
		})

		t.Run("`clientSecret` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAzure.DeepCopy()
				keeper.Spec.Azure.ClientSecret = secretv0alpha1.CredentialValue{}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.azure.clientSecret", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperAzure.DeepCopy()
				keeper.Spec.Azure.ClientSecret = secretv0alpha1.CredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.azure.clientSecret", errs[0].Field)
			})
		})
	})

	t.Run("gcp keeper validation", func(t *testing.T) {
		validKeeperGCP := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title: "title",
				GCP: &secretv0alpha1.GCPKeeperConfig{
					GCPCredentials: secretv0alpha1.GCPCredentials{
						ProjectID:       "project-id",
						CredentialsFile: "/path/to/credentials/file.json",
					},
				},
			},
		}

		t.Run("`projectId` must be present", func(t *testing.T) {
			keeper := validKeeperGCP.DeepCopy()
			keeper.Spec.GCP.ProjectID = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.gcp.projectId", errs[0].Field)
		})

		t.Run("`credentialsFile` must be present", func(t *testing.T) {
			keeper := validKeeperGCP.DeepCopy()
			keeper.Spec.GCP.CredentialsFile = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.gcp.credentialsFile", errs[0].Field)
		})
	})

	t.Run("hashicorp keeper validation", func(t *testing.T) {
		validKeeperHashiCorp := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Title: "title",
				HashiCorp: &secretv0alpha1.HashiCorpKeeperConfig{
					HashiCorpCredentials: secretv0alpha1.HashiCorpCredentials{
						Address: "http://address",
						Token: secretv0alpha1.CredentialValue{
							ValueFromConfig: "config.path.value",
						},
					},
				},
			},
		}

		t.Run("`address` must be present", func(t *testing.T) {
			keeper := validKeeperHashiCorp.DeepCopy()
			keeper.Spec.HashiCorp.Address = ""

			errs := ValidateKeeper(keeper, admission.Create)
			require.Len(t, errs, 1)
			require.Equal(t, "spec.hashicorp.address", errs[0].Field)
		})

		t.Run("`token` must be present", func(t *testing.T) {
			t.Run("at least one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperHashiCorp.DeepCopy()
				keeper.Spec.HashiCorp.Token = secretv0alpha1.CredentialValue{}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.hashicorp.token", errs[0].Field)
			})

			t.Run("at most one of the credential value must be present", func(t *testing.T) {
				keeper := validKeeperHashiCorp.DeepCopy()
				keeper.Spec.HashiCorp.Token = secretv0alpha1.CredentialValue{
					SecureValueName: "a",
					ValueFromEnv:    "b",
					ValueFromConfig: "c",
				}

				errs := ValidateKeeper(keeper, admission.Create)
				require.Len(t, errs, 1)
				require.Equal(t, "spec.hashicorp.token", errs[0].Field)
			})
		})
	})

	t.Run("sql keeper validation", func(t *testing.T) {
		t.Run("does not allow usage of `secureValueName` in credentials", func(t *testing.T) {
			providers := []struct {
				name           string
				enc            secretv0alpha1.Encryption
				expectedErrors int
			}{
				{
					name: "aws",
					enc: secretv0alpha1.Encryption{
						AWS: &secretv0alpha1.AWSCredentials{
							AccessKeyID: secretv0alpha1.CredentialValue{
								SecureValueName: "not-empty",
							},
							SecretAccessKey: secretv0alpha1.CredentialValue{
								SecureValueName: "not-empty",
							},
						},
					},
					expectedErrors: 2,
				},
				{
					name: "azure",
					enc: secretv0alpha1.Encryption{
						Azure: &secretv0alpha1.AzureCredentials{
							ClientSecret: secretv0alpha1.CredentialValue{
								SecureValueName: "not-empty",
							},
						},
					},
					expectedErrors: 1,
				},
				{
					name: "hashicorp",
					enc: secretv0alpha1.Encryption{
						HashiCorp: &secretv0alpha1.HashiCorpCredentials{
							Token: secretv0alpha1.CredentialValue{
								SecureValueName: "not-empty",
							},
						},
					},
					expectedErrors: 1,
				},
			}

			for _, tc := range providers {
				t.Run("when using credentials for "+tc.name, func(t *testing.T) {
					keeper := &secretv0alpha1.Keeper{
						Spec: secretv0alpha1.KeeperSpec{
							Title: "title",
							SQL:   &secretv0alpha1.SQLKeeperConfig{Encryption: &tc.enc},
						},
					}

					errs := ValidateKeeper(keeper, admission.Create)
					require.Len(t, errs, tc.expectedErrors)
				})
			}
		})
	})
}
