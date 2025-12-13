package validator

import (
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type keeperValidator struct{}

var _ contracts.KeeperValidator = &keeperValidator{}

func ProvideKeeperValidator() contracts.KeeperValidator {
	return &keeperValidator{}
}

func (v *keeperValidator) Validate(keeper *secretv1beta1.Keeper, oldKeeper *secretv1beta1.Keeper, operation admission.Operation) field.ErrorList {
	errs := make(field.ErrorList, 0)

	// General validations.
	if err := validation.IsDNS1123Subdomain(keeper.Name); len(err) > 0 {
		errs = append(
			errs,
			field.Invalid(field.NewPath("metadata", "name"), keeper.Name, strings.Join(err, ",")),
		)
	}
	if err := validation.IsDNS1123Subdomain(keeper.Namespace); len(err) > 0 {
		errs = append(
			errs,
			field.Invalid(field.NewPath("metadata", "namespace"), keeper.Name, strings.Join(err, ",")),
		)
	}

	// Only validate Create and Update for now.
	if operation != admission.Create && operation != admission.Update {
		return errs
	}

	if keeper.Name == contracts.SystemKeeperName {
		errs = append(errs, field.Forbidden(field.NewPath("name"), "the keeper name `system` is reserved"))
	}

	if keeper.Spec.Description == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "description"), "a `description` is required"))
	}

	// Only one keeper type can be configured. Return early and don't validate the specific keeper fields.
	if err := validateKeepers(keeper); err != nil {
		errs = append(errs, err)

		return errs
	}

	if keeper.Spec.Aws != nil {
		errs = append(errs, validateAws(keeper.Spec.Aws)...)
	}

	if keeper.Spec.Azure != nil {
		errs = append(errs, validateAzure(keeper.Spec.Azure)...)
	}

	if keeper.Spec.Gcp != nil {
		errs = append(errs, validateGcp(keeper.Spec.Gcp)...)
	}

	if keeper.Spec.HashiCorpVault != nil {
		errs = append(errs, validateHashiCorpVault(keeper.Spec.HashiCorpVault)...)
	}

	return errs
}

func validateAws(cfg *secretv1beta1.KeeperAWSConfig) field.ErrorList {
	errs := make(field.ErrorList, 0)

	if cfg.Region == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "aws", "region"), "region must be present"))
	}

	switch {
	case cfg.AccessKey == nil && cfg.AssumeRole == nil:
		errs = append(errs, field.Required(field.NewPath("spec", "aws"), "one of `accessKey` or `assumeRole` must be present"))

	case cfg.AccessKey != nil && cfg.AssumeRole != nil:
		errs = append(errs, field.Required(field.NewPath("spec", "aws"), "only one of `accessKey` or `assumeRole` can be present"))

	case cfg.AccessKey != nil:
		if err := validateCredentialValue(field.NewPath("spec", "aws", "accessKey", "accessKeyID"), cfg.AccessKey.AccessKeyID); err != nil {
			errs = append(errs, err)
		}
		if err := validateCredentialValue(field.NewPath("spec", "aws", "accessKey", "secretAccessKey"), cfg.AccessKey.SecretAccessKey); err != nil {
			errs = append(errs, err)
		}

	case cfg.AssumeRole != nil:
		if cfg.AssumeRole.AssumeRoleArn == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "aws", "assumeRole", "assumeRoleArn"), "arn of the role to assume must be present"))
		}
		if cfg.AssumeRole.ExternalID == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "aws", "assumeRole", "externalId"), "externalId must be present"))
		}
	}

	return errs
}

func validateAzure(cfg *secretv1beta1.KeeperAzureConfig) field.ErrorList {
	errs := make(field.ErrorList, 0)

	if cfg.KeyVaultName == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "azure", "keyVaultName"), "a `keyVaultName` is required"))
	}

	if cfg.TenantID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "azure", "tenantID"), "a `tenantID` is required"))
	}

	if cfg.ClientID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "azure", "clientID"), "a `clientID` is required"))
	}

	if err := validateCredentialValue(field.NewPath("spec", "azure", "clientSecret"), cfg.ClientSecret); err != nil {
		errs = append(errs, err)
	}

	return errs
}

func validateGcp(cfg *secretv1beta1.KeeperGCPConfig) field.ErrorList {
	errs := make(field.ErrorList, 0)

	if cfg.ProjectID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "gcp", "projectID"), "a `projectID` is required"))
	}

	if cfg.CredentialsFile == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "gcp", "credentialsFile"), "a `credentialsFile` is required"))
	}

	return errs
}

func validateHashiCorpVault(cfg *secretv1beta1.KeeperHashiCorpConfig) field.ErrorList {
	errs := make(field.ErrorList, 0)

	if cfg.Address == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "hashiCorpVault", "address"), "an `address` is required"))
	}

	if err := validateCredentialValue(field.NewPath("spec", "hashiCorpVault", "token"), cfg.Token); err != nil {
		errs = append(errs, err)
	}

	return errs
}

func validateKeepers(keeper *secretv1beta1.Keeper) *field.Error {
	availableKeepers := map[string]bool{
		"aws":            keeper.Spec.Aws != nil,
		"azure":          keeper.Spec.Azure != nil,
		"gcp":            keeper.Spec.Gcp != nil,
		"hashiCorpVault": keeper.Spec.HashiCorpVault != nil,
	}

	configuredKeepers := make([]string, 0)

	for keeperKind, notNil := range availableKeepers {
		if notNil {
			configuredKeepers = append(configuredKeepers, keeperKind)
		}
	}

	if len(configuredKeepers) == 0 {
		return field.Required(field.NewPath("spec"), "at least one `keeper` must be present")
	}

	if len(configuredKeepers) > 1 {
		return field.Invalid(
			field.NewPath("spec"),
			strings.Join(configuredKeepers, " & "),
			"only one `keeper` can be present at a time but found more",
		)
	}

	return nil
}

func validateCredentialValue(path *field.Path, credentials secretv1beta1.KeeperCredentialValue) *field.Error {
	availableOptions := map[string]bool{
		"secureValueName": credentials.SecureValueName != "",
		"valueFromEnv":    credentials.ValueFromEnv != "",
		"valueFromConfig": credentials.ValueFromConfig != "",
	}

	configuredCredentials := make([]string, 0)

	for credentialKind, notEmpty := range availableOptions {
		if notEmpty {
			configuredCredentials = append(configuredCredentials, credentialKind)
		}
	}

	if len(configuredCredentials) == 0 {
		return field.Required(path, "one of `secureValueName`, `valueFromEnv` or `valueFromConfig` must be present")
	}

	if len(configuredCredentials) > 1 {
		return field.Invalid(
			path,
			strings.Join(configuredCredentials, " & "),
			"only one of `secureValueName`, `valueFromEnv` or `valueFromConfig` must be present at a time but found more",
		)
	}

	return nil
}
