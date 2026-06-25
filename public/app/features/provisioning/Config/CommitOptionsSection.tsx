import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useState } from 'react';
import {
  type Control,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormRegister,
  type UseFormSetValue,
  Controller,
  useWatch,
} from 'react-hook-form';

import { t } from '@grafana/i18n';
import {
  Checkbox,
  ControlledCollapse,
  Field,
  Input,
  RadioButtonGroup,
  SecretTextArea,
  Stack,
  TextArea,
} from '@grafana/ui';

import { CommitSigningInfo } from '../Shared/CommitSigningInfo';
import { getGitProviderFields, getSigningMethodOptions, getSigningKeyPlaceholder } from '../Wizard/fields';
import { type RepoType } from '../Wizard/types';
import { getHasTokenInstructions } from '../utils/git';
import { validateSigner, validateSigningKey, validateSmimeCertificate } from '../utils/validators';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  messageTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
  type: RepoType;
  signingMethodName: Path<T>;
  signingKeyName: Path<T>;
  smimeCertificateName: Path<T>;
  signerNameName: Path<T>;
  signerEmailName: Path<T>;
  defaultSigningKeyConfigured?: boolean;
}

/**
 * Advanced commit options (RepositorySpec.commit / CommitOptions). Collapsed by
 * default since the built-in defaults are sensible and most users won't change
 * them. The enforce-template option is gated behind the provisioning.gitConventions
 * flag; the message template itself is always available.
 */
export function CommitOptionsSection<T extends FieldValues>({
  register,
  control,
  setValue,
  messageTemplateName,
  enforceTemplateName,
  type,
  signingMethodName,
  signingKeyName,
  smimeCertificateName,
  signerNameName,
  signerEmailName,
  defaultSigningKeyConfigured,
}: Props<T>) {
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  const [signingKeyConfigured, setSigningKeyConfigured] = useState(Boolean(defaultSigningKeyConfigured));
  const signingMethod = useWatch({ control, name: signingMethodName });
  const signingEnabled = Boolean(signingMethod);
  const signingRequired = signingEnabled && !signingKeyConfigured;
  const hasTokenInstructions = getHasTokenInstructions(type);
  const gitFields = getGitProviderFields(type);

  const resetSigning = () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const empty = '' as PathValue<T, Path<T>>;
    setValue(signingKeyName, empty);
    setValue(smimeCertificateName, empty);
    setValue(signerNameName, empty);
    setValue(signerEmailName, empty);
    setSigningKeyConfigured(false);
  };

  return (
    <ControlledCollapse
      label={t('provisioning.commit-options.label-commit-options', 'Commit options')}
      isOpen={signingEnabled}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.config-form.label-commit-message-template', 'Commit message template')}
          description={t(
            'provisioning.config-form.description-commit-message-template',
            'The commit message used when someone saves, moves, renames, or deletes a resource and leaves the Comment field blank. Placeholders, filled in per operation: {{actionVar}} (create/update/delete/move/rename), {{kindVar}} (dashboard/folder), {{idVar}} (unique resource ID), {{titleVar}}, {{userNameVar}} (display name), {{userLoginVar}} (username), {{userEmailVar}}. Leave blank to use the built-in default messages.',
            {
              actionVar: '{{action}}',
              kindVar: '{{resourceKind}}',
              idVar: '{{resourceID}}',
              titleVar: '{{title}}',
              userNameVar: '{{userName}}',
              userLoginVar: '{{userLogin}}',
              userEmailVar: '{{userEmail}}',
            }
          )}
        >
          <Input
            id="commit-message-template"
            {...register(messageTemplateName)}
            placeholder={t(
              'provisioning.config-form.placeholder-commit-message-template',
              'feat(dashboards): {{actionVar}} {{titleVar}}',
              { actionVar: '{{action}}', titleVar: '{{title}}' }
            )}
          />
        </Field>

        {gitConventionsEnabled && (
          <Field noMargin>
            <Checkbox
              {...register(enforceTemplateName)}
              label={t('provisioning.commit-options.label-enforce-template', 'Enforce commit message template')}
              description={t(
                'provisioning.commit-options.description-enforce-template',
                'Pre-fill the commit message in save dialogs from the template above and make it read-only.'
              )}
            />
          </Field>
        )}

        {gitFields?.signingMethodConfig && (
          <Field
            noMargin
            label={gitFields.signingMethodConfig.label}
            description={
              hasTokenInstructions ? <CommitSigningInfo type={type} /> : gitFields.signingMethodConfig.description
            }
          >
            <Controller
              name={signingMethodName}
              control={control}
              render={({ field: { ref, ...field } }) => (
                <RadioButtonGroup
                  {...field}
                  options={getSigningMethodOptions()}
                  disabled={signingEnabled && signingKeyConfigured}
                  onChange={(value) => {
                    field.onChange(value);
                    resetSigning();
                  }}
                />
              )}
            />
          </Field>
        )}
        {signingEnabled && gitFields?.signingKeyConfig && (
          <>
            <Controller
              name={signingKeyName}
              control={control}
              rules={{ validate: validateSigningKey(signingRequired) }}
              render={({ field: { ref, ...field }, fieldState }) => (
                <Field
                  noMargin
                  htmlFor="commit-signing-key"
                  required={signingEnabled}
                  label={gitFields.signingKeyConfig?.label}
                  description={gitFields.signingKeyConfig?.description}
                  error={fieldState.error?.message}
                  invalid={!!fieldState.error}
                >
                  <SecretTextArea
                    {...field}
                    id="commit-signing-key"
                    spellCheck={false}
                    invalid={!!fieldState.error}
                    placeholder={getSigningKeyPlaceholder(signingMethod)}
                    isConfigured={signingKeyConfigured}
                    onReset={resetSigning}
                    rows={8}
                    grow
                  />
                </Field>
              )}
            />
            {signingMethod === 'smime' && gitFields.smimeCertificateConfig && (
              <Controller
                name={smimeCertificateName}
                control={control}
                rules={{ validate: validateSmimeCertificate(signingMethod) }}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="smime-certificate"
                    required={signingMethod === 'smime'}
                    label={gitFields.smimeCertificateConfig?.label}
                    description={gitFields.smimeCertificateConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <TextArea
                      {...field}
                      id="smime-certificate"
                      spellCheck={false}
                      invalid={!!fieldState.error}
                      placeholder={gitFields.smimeCertificateConfig?.placeholder}
                      disabled={signingKeyConfigured}
                      value={
                        signingKeyConfigured
                          ? t('provisioning.commit-options.smime-certificate-configured', 'Configured')
                          : field.value
                      }
                      rows={signingKeyConfigured ? 1 : 8}
                    />
                  </Field>
                )}
              />
            )}
            {gitFields.commitSignerNameConfig && (
              <Controller
                name={signerNameName}
                control={control}
                rules={{ validate: validateSigner(signingEnabled) }}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="commit-signer-name"
                    required={signingEnabled}
                    label={gitFields.commitSignerNameConfig?.label}
                    description={gitFields.commitSignerNameConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <Input
                      {...field}
                      id="commit-signer-name"
                      disabled={signingKeyConfigured}
                      placeholder={gitFields.commitSignerNameConfig?.placeholder}
                    />
                  </Field>
                )}
              />
            )}
            {gitFields.commitSignerEmailConfig && (
              <Controller
                name={signerEmailName}
                control={control}
                rules={{ validate: validateSigner(signingEnabled) }}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="commit-signer-email"
                    required={signingEnabled}
                    label={gitFields.commitSignerEmailConfig?.label}
                    description={gitFields.commitSignerEmailConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <Input
                      {...field}
                      id="commit-signer-email"
                      type="email"
                      disabled={signingKeyConfigured}
                      placeholder={gitFields.commitSignerEmailConfig?.placeholder}
                    />
                  </Field>
                )}
              />
            )}
          </>
        )}
      </Stack>
    </ControlledCollapse>
  );
}
