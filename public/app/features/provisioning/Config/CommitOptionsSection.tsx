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
import { Checkbox, ControlledCollapse, Field, Input, RadioButtonGroup, SecretTextArea, Stack, TextArea } from '@grafana/ui';

import { GPGSigningKeyInfo } from '../Shared/GPGSigningKeyInfo';
import {
  getCommitAuthorRequiredMessage,
  getGitProviderFields,
  getSigningFormatOptions,
  getSigningKeyPlaceholder,
} from '../Wizard/fields';
import { type RepoType } from '../Wizard/types';
import { getHasTokenInstructions } from '../utils/git';

type GitProviderFields = NonNullable<ReturnType<typeof getGitProviderFields>>;

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  messageTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
  type: RepoType;
  gitFields: GitProviderFields;
  signingFormatName: Path<T>;
  signingKeyName: Path<T>;
  smimeCertificateName: Path<T>;
  authorNameName: Path<T>;
  authorEmailName: Path<T>;
  defaultSigningKeyConfigured?: boolean;
}

/**
 * Advanced commit options (RepositorySpec.commit / CommitOptions). Collapsed by
 * default since the built-in defaults are sensible and most users won't change
 * them.
 */
export function CommitOptionsSection<T extends FieldValues>({
  register,
  control,
  setValue,
  messageTemplateName,
  enforceTemplateName,
  type,
  gitFields,
  signingFormatName,
  signingKeyName,
  smimeCertificateName,
  authorNameName,
  authorEmailName,
  defaultSigningKeyConfigured,
}: Props<T>) {
  const [signingKeyConfigured, setSigningKeyConfigured] = useState(Boolean(defaultSigningKeyConfigured));
  const signingFormat = useWatch({ control, name: signingFormatName }) ?? 'none';
  const signingKeyValue = useWatch({ control, name: signingKeyName });
  const signingEnabled = signingFormat !== 'none';
  const authorRequired = Boolean(signingKeyValue);
  const authorRequiredMessage = getCommitAuthorRequiredMessage();
  const hasTokenInstructions = getHasTokenInstructions(type);

  const empty = '' as PathValue<T, Path<T>>;
  const validateAuthor = (val: unknown) =>
    !authorRequired || (typeof val === 'string' && val.trim().length > 0) || authorRequiredMessage;

  return (
    <ControlledCollapse
      label={t('provisioning.commit-options.label-commit-options', 'Commit options (advanced)')}
      isOpen={signingEnabled}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.config-form.label-commit-message-template', 'Commit message template')}
          description={t(
            'provisioning.config-form.description-commit-message-template',
            'Default commit message when saving a provisioned resource. Available placeholders: {{actionVar}} (create/update/delete/move/rename), {{kindVar}} (dashboard/folder), {{idVar}}, {{titleVar}}, {{userNameVar}}, {{userLoginVar}}, {{userEmailVar}}. A "Grafana-saved-by: <name> (<login>)" trailer is appended automatically. Leave empty to use the built-in defaults.',
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

        <Field noMargin>
          <Checkbox
            {...register(enforceTemplateName)}
            label={t('provisioning.commit-options.label-enforce-template', 'Enforce commit message template')}
            description={t(
              'provisioning.commit-options.description-enforce-template',
              'Pre-fill the commit message in save dialogs from the template above and make it read-only. The "Grafana-saved-by" trailer is always appended.'
            )}
          />
        </Field>

        {gitFields.signingFormatConfig && (
          <Field
            noMargin
            label={gitFields.signingFormatConfig.label}
            description={gitFields.signingFormatConfig.description}
          >
            <Controller
              name={signingFormatName}
              control={control}
              render={({ field: { ref, ...field } }) => (
                <RadioButtonGroup
                  {...field}
                  options={getSigningFormatOptions()}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue(signingKeyName, empty);
                    setValue(smimeCertificateName, empty);
                    setSigningKeyConfigured(false);
                  }}
                />
              )}
            />
          </Field>
        )}
        {signingEnabled && gitFields.signingKeyConfig && (
          <>
            {hasTokenInstructions && <GPGSigningKeyInfo type={type} />}
            <Controller
              name={signingKeyName}
              control={control}
              render={({ field: { ref, ...field }, fieldState }) => (
                <Field
                  noMargin
                  htmlFor="signingKey"
                  label={gitFields.signingKeyConfig?.label}
                  description={gitFields.signingKeyConfig?.description}
                  error={fieldState.error?.message}
                  invalid={!!fieldState.error}
                >
                  <SecretTextArea
                    {...field}
                    id="signingKey"
                    invalid={!!fieldState.error}
                    placeholder={getSigningKeyPlaceholder(signingFormat)}
                    isConfigured={signingKeyConfigured}
                    onReset={() => {
                      setValue(signingKeyName, empty);
                      setValue(authorNameName, empty);
                      setValue(authorEmailName, empty);
                      setSigningKeyConfigured(false);
                    }}
                    rows={8}
                    grow
                  />
                </Field>
              )}
            />
            {signingFormat === 'smime' && gitFields.smimeCertificateConfig && (
              <Controller
                name={smimeCertificateName}
                control={control}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="smimeCertificate"
                    label={gitFields.smimeCertificateConfig?.label}
                    description={gitFields.smimeCertificateConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <TextArea
                      {...field}
                      id="smimeCertificate"
                      invalid={!!fieldState.error}
                      placeholder={gitFields.smimeCertificateConfig?.placeholder}
                      rows={8}
                    />
                  </Field>
                )}
              />
            )}
            {gitFields.commitAuthorNameConfig && (
              <Controller
                name={authorNameName}
                control={control}
                rules={{ validate: validateAuthor }}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="commit-author-name"
                    required={authorRequired}
                    label={gitFields.commitAuthorNameConfig?.label}
                    description={gitFields.commitAuthorNameConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <Input
                      {...field}
                      id="commit-author-name"
                      disabled={!signingKeyValue}
                      placeholder={gitFields.commitAuthorNameConfig?.placeholder}
                    />
                  </Field>
                )}
              />
            )}
            {gitFields.commitAuthorEmailConfig && (
              <Controller
                name={authorEmailName}
                control={control}
                rules={{ validate: validateAuthor }}
                render={({ field: { ref, ...field }, fieldState }) => (
                  <Field
                    noMargin
                    htmlFor="commit-author-email"
                    required={authorRequired}
                    label={gitFields.commitAuthorEmailConfig?.label}
                    description={gitFields.commitAuthorEmailConfig?.description}
                    error={fieldState.error?.message}
                    invalid={!!fieldState.error}
                  >
                    <Input
                      {...field}
                      id="commit-author-email"
                      type="email"
                      disabled={!signingKeyValue}
                      placeholder={gitFields.commitAuthorEmailConfig?.placeholder}
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
