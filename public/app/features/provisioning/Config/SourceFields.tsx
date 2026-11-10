import { useState } from 'react';
import { type Control, type FieldValues, type Path, type UseFormRegister, Controller, useWatch } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Checkbox,
  Combobox,
  ControlledCollapse,
  Field,
  IconButton,
  Input,
  SecretInput,
  Stack,
  Text,
  TextArea,
  TextLink,
} from '@grafana/ui';
import { type SourceAllowedKind } from 'app/api/clients/provisioning/v0alpha1';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { getEmptyTreePolicyOptions, getSourceAuthTypeOptions, getSourceProviderFields } from '../Wizard/fields';
import { CONNECTIONS_URL } from '../constants';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { validateAllowedKinds } from '../utils/validators';

// Form values start out undefined for fields the saved spec doesn't carry.
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

interface SourceFieldNames<T extends FieldValues> {
  url: Path<T>;
  authType: Path<T>;
  token: Path<T>;
  connectionName: Path<T>;
  allow: Path<T>;
  emptyTreePolicy: Path<T>;
  caBundle: Path<T>;
  serverName: Path<T>;
}

interface Props<T extends FieldValues> {
  control: Control<T>;
  names: SourceFieldNames<T>;
  /** Edit mode: the repository already stores a bearer token. */
  tokenConfigured?: boolean;
}

/**
 * Fields of a Source API repository (RepositorySpec.source). Sources have no branch workflow,
 * commit conventions or webhooks, so none of those options apply.
 */
export function SourceFields<T extends FieldValues>({ control, names, tokenConfigured = false }: Props<T>) {
  const [isTokenConfigured, setIsTokenConfigured] = useState(tokenConfigured);
  const { urlConfig, tokenConfig } = getSourceProviderFields();

  const authType = useWatch({ control, name: names.authType });
  const caBundle = useWatch({ control, name: names.caBundle });
  const serverName = useWatch({ control, name: names.serverName });
  const isBearer = !authType || authType === 'bearer';
  const isClientCredentials = authType === 'clientCredentials';
  // Token exchange needs a token exchange service, which on-prem instances don't have.
  const authTypeOptions = getSourceAuthTypeOptions(!isOnPrem() || authType === 'tokenExchange');

  const {
    options: connectionOptions,
    isLoading: connectionsLoading,
    connections,
  } = useConnectionOptions(isClientCredentials, ['source']);

  return (
    <>
      <Controller
        name={names.url}
        control={control}
        rules={urlConfig.validation}
        render={({ field: { ref, ...field }, fieldState }) => (
          <Field
            noMargin
            htmlFor="source-url"
            label={urlConfig.label}
            description={urlConfig.description}
            required={urlConfig.required}
            error={fieldState.error?.message}
            invalid={!!fieldState.error}
          >
            <Input {...field} id="source-url" invalid={!!fieldState.error} placeholder={urlConfig.placeholder} />
          </Field>
        )}
      />

      <Controller
        name={names.authType}
        control={control}
        render={({ field: { ref, onChange, ...field }, fieldState }) => (
          <Field
            noMargin
            htmlFor="source-auth-type"
            label={t('provisioning.source.auth-type-label', 'Authentication')}
            description={t(
              'provisioning.source.auth-type-description',
              'How Grafana authenticates to the source. Token exchange is only available where a token exchange service is configured and needs no token or connection.'
            )}
            error={fieldState.error?.message}
            invalid={!!fieldState.error}
          >
            <Combobox
              {...field}
              id="source-auth-type"
              options={authTypeOptions}
              onChange={(option) => onChange(option.value)}
              invalid={!!fieldState.error}
            />
          </Field>
        )}
      />

      {isBearer && (
        <Controller
          name={names.token}
          control={control}
          rules={{ required: isTokenConfigured ? false : tokenConfig.validation?.required }}
          render={({ field: { ref, onChange, ...field }, fieldState }) => (
            <Field
              noMargin
              htmlFor="source-token"
              label={tokenConfig.label}
              description={tokenConfig.description}
              required={tokenConfig.required}
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            >
              <SecretInput
                {...field}
                id="source-token"
                value={asText(field.value)}
                onChange={onChange}
                invalid={!!fieldState.error}
                isConfigured={isTokenConfigured}
                revealable
                onReset={() => {
                  onChange('');
                  setIsTokenConfigured(false);
                }}
              />
            </Field>
          )}
        />
      )}

      {isClientCredentials && (
        <Controller
          name={names.connectionName}
          control={control}
          rules={{
            required: t('provisioning.source.connection-required', 'A source connection is required'),
          }}
          render={({ field: { ref, onChange, ...field }, fieldState }) => (
            <Field
              noMargin
              htmlFor="source-connection"
              label={t('provisioning.source.connection-label', 'Connection')}
              description={
                <>
                  <Trans i18nKey="provisioning.source.connection-description">
                    The source connection that provides the client-credentials token.
                  </Trans>
                  {!connectionsLoading && connections.length === 0 && (
                    <>
                      {' '}
                      <TextLink variant="bodySmall" href={`${CONNECTIONS_URL}/new`}>
                        <Trans i18nKey="provisioning.source.connection-create">Create a source connection</Trans>
                      </TextLink>
                    </>
                  )}
                </>
              }
              required
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            >
              <Combobox
                {...field}
                id="source-connection"
                options={connectionOptions}
                onChange={(option) => onChange(option?.value ?? '')}
                loading={connectionsLoading}
                disabled={connectionsLoading}
                invalid={!!fieldState.error}
              />
            </Field>
          )}
        />
      )}

      <Controller
        name={names.allow}
        control={control}
        rules={{ validate: validateAllowedKinds }}
        render={({ field: { value, onChange }, fieldState }) => (
          <Field
            noMargin
            label={t('provisioning.source.allow-label', 'Allowed kinds')}
            description={t(
              'provisioning.source.allow-description',
              'The kinds the source may write. When empty, only dashboards are allowed. Folders are always allowed.'
            )}
            error={fieldState.error?.message}
            invalid={!!fieldState.error}
          >
            <AllowedKindsEditor rows={Array.isArray(value) ? value : []} onChange={onChange} />
          </Field>
        )}
      />

      <Controller
        name={names.emptyTreePolicy}
        control={control}
        render={({ field: { ref, onChange, ...field }, fieldState }) => (
          <Field
            noMargin
            htmlFor="source-empty-tree-policy"
            label={t('provisioning.source.empty-tree-policy-label', 'When the source is empty')}
            description={t(
              'provisioning.source.empty-tree-policy-description',
              'What to do when the source returns an empty tree for a repository that manages resources.'
            )}
            error={fieldState.error?.message}
            invalid={!!fieldState.error}
          >
            <Combobox
              {...field}
              id="source-empty-tree-policy"
              options={getEmptyTreePolicyOptions()}
              onChange={(option) => onChange(option.value)}
              invalid={!!fieldState.error}
            />
          </Field>
        )}
      />

      <ControlledCollapse
        label={t('provisioning.source.tls-label', 'TLS options')}
        isOpen={Boolean(caBundle || serverName)}
      >
        <Stack direction="column" gap={2}>
          <Controller
            name={names.caBundle}
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <Field
                noMargin
                htmlFor="source-ca-bundle"
                label={t('provisioning.source.ca-bundle-label', 'CA bundle')}
                description={t(
                  'provisioning.source.ca-bundle-description',
                  "PEM-encoded CA certificates that sign the source's server certificate, in addition to the system roots."
                )}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
              >
                <TextArea
                  {...field}
                  id="source-ca-bundle"
                  value={asText(field.value)}
                  spellCheck={false}
                  invalid={!!fieldState.error}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="-----BEGIN CERTIFICATE-----"
                  rows={6}
                />
              </Field>
            )}
          />
          <Controller
            name={names.serverName}
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <Field
                noMargin
                htmlFor="source-server-name"
                label={t('provisioning.source.server-name-label', 'Server name')}
                description={t(
                  'provisioning.source.server-name-description',
                  'Overrides the server name used to verify the certificate.'
                )}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
              >
                <Input {...field} id="source-server-name" value={asText(field.value)} invalid={!!fieldState.error} />
              </Field>
            )}
          />
        </Stack>
      </ControlledCollapse>
    </>
  );
}

// A component of its own because Field passes `invalid` to its direct child.
function AllowedKindsEditor({
  rows,
  onChange,
}: {
  rows: SourceAllowedKind[];
  onChange: (rows: SourceAllowedKind[]) => void;
}) {
  const updateRow = (index: number, change: Partial<SourceAllowedKind>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <Stack direction="column" gap={1}>
      {rows.map((row, index) => (
        <Stack key={index} direction="row" gap={1} alignItems="center">
          <Input
            aria-label={t('provisioning.source.allow-group-aria', 'Group of allowed kind {{position}}', {
              position: index + 1,
            })}
            value={row.group}
            onChange={(e) => updateRow(index, { group: e.currentTarget.value })}
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="dashboard.grafana.app"
          />
          <Input
            aria-label={t('provisioning.source.allow-kind-aria', 'Kind of allowed kind {{position}}', {
              position: index + 1,
            })}
            value={row.kind}
            onChange={(e) => updateRow(index, { kind: e.currentTarget.value })}
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="Dashboard"
          />
          <IconButton
            name="trash-alt"
            tooltip={t('provisioning.source.allow-remove', 'Remove allowed kind {{position}}', {
              position: index + 1,
            })}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          />
        </Stack>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={() => onChange([...rows, { group: '', kind: '' }])}
        >
          <Trans i18nKey="provisioning.source.allow-add">Add kind</Trans>
        </Button>
      </div>
    </Stack>
  );
}

interface SourceReadOnlyOptionProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  name: Path<T>;
  readOnly: boolean;
  error?: string;
}

/** Read-only toggle; when it is off, edits saved in Grafana are written back to the source. */
export function SourceReadOnlyOption<T extends FieldValues>({
  register,
  name,
  readOnly,
  error,
}: SourceReadOnlyOptionProps<T>) {
  return (
    <>
      <Field noMargin invalid={!!error} error={error}>
        <Checkbox
          {...register(name)}
          label={t('provisioning.finish-step.label-read-only', 'Read only')}
          description={t(
            'provisioning.source.read-only-description',
            "Resources can't be modified through Grafana. When off, changes saved in Grafana are written back to the source, which must support edits."
          )}
        />
      </Field>
      {readOnly && (
        <Text color="secondary">
          <Trans i18nKey="provisioning.source.read-only-note">Resources can only be changed at the source.</Trans>
        </Text>
      )}
    </>
  );
}
