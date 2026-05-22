import { Controller, type FieldErrors, type UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Alert, Button, Field, Input, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getUidFieldDescription, getUidFieldLabel } from 'app/features/manage-dashboards/import/utils/uidFieldText';
import { type DashboardInput, type DashboardInputs, type DataSourceInput } from 'app/features/manage-dashboards/types';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { ProvisioningAwareFolderPicker } from '../Shared/ProvisioningAwareFolderPicker';
import { RepoInvalidStateBanner } from '../Shared/RepoInvalidStateBanner';
import { ResourceEditFormSharedFields } from '../Shared/ResourceEditFormSharedFields';

import { type ProvisionedImportFormData } from './ProvisionedImportOverview';

interface Props extends Pick<UseFormReturn<ProvisionedImportFormData>, 'register' | 'control'> {
  inputs: DashboardInputs;
  errors: FieldErrors<ProvisionedImportFormData>;
  isReadOnlyRepo: boolean;
  isOrphaned: boolean;
  isLibraryPanelImportBlocked: boolean;
  hasFloatGridItems: boolean;
  canPushToConfiguredBranch: boolean;
  repository?: RepositoryView;
  submitDisabled: boolean;
  isLoading: boolean;
  error?: string;
  onCancel: () => void;
}

export function ProvisionedImportForm({
  register,
  control,
  errors,
  inputs,
  isReadOnlyRepo,
  isOrphaned,
  isLibraryPanelImportBlocked,
  hasFloatGridItems,
  canPushToConfiguredBranch,
  repository,
  submitDisabled,
  isLoading,
  error,
  onCancel,
}: Props) {
  return (
    <Stack direction="column" gap={2}>
      {/* Banners */}
      {(isReadOnlyRepo || isOrphaned) && (
        <RepoInvalidStateBanner noRepository={isOrphaned} isReadOnlyRepo={isReadOnlyRepo} />
      )}

      {isLibraryPanelImportBlocked && (
        <Alert
          severity="warning"
          title={t('provisioning.import.library-panels-blocked-title', 'Library panels not supported')}
        >
          <Trans i18nKey="provisioning.import.library-panels-blocked-body">
            This dashboard contains library panels that cannot be created through a provisioned import. Import into a
            non-provisioned folder instead, or remove the library panel references first.
          </Trans>
        </Alert>
      )}

      {hasFloatGridItems && (
        <Alert
          severity="warning"
          title={t('provisioning.import.float-grid-items-title', 'Floating grid items')}
          data-testid={selectors.components.ImportDashboardForm.floatGridItemsWarning}
        >
          <Trans i18nKey="provisioning.import.float-grid-items-body">
            The dashboard contains grid items with floating positions. This is not supported by Grafana and the numbers
            will be truncated to integers.
          </Trans>
        </Alert>
      )}

      {/* Name */}
      <Field
        label={t('provisioning.import.label-name', 'Name')}
        invalid={!!errors.title}
        error={errors.title?.message}
        noMargin
      >
        <Input
          {...register('title', { required: t('provisioning.import.name-required', 'Name is required') })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>

      {/* Folder (Grafana target folder) */}
      <Field label={t('provisioning.import.label-folder', 'Folder')} noMargin>
        <Controller
          name="folderUid"
          control={control}
          render={({ field: { ref, value, onChange, ...field } }) => (
            <ProvisioningAwareFolderPicker
              {...field}
              onChange={(uid) => onChange(uid ?? '')}
              value={typeof value === 'string' ? value : ''}
              repositoryName={repository?.name}
            />
          )}
        />
      </Field>

      {/* UID */}
      <Field
        label={getUidFieldLabel()}
        description={getUidFieldDescription()}
        invalid={!!errors.uid}
        error={errors.uid?.message}
        noMargin
      >
        <Input {...register('uid')} type="text" data-testid="provisioned-import-uid" />
      </Field>

      {/* Datasource inputs */}
      {inputs.dataSources.map((input: DataSourceInput) => {
        if (input.pluginId === ExpressionDatasourceRef.type) {
          return null;
        }
        const fieldName = `datasource-${input.name}`;
        return (
          <Field
            label={input.name}
            description={input.description}
            key={fieldName}
            invalid={!!errors[fieldName]}
            error={
              errors[fieldName]
                ? t('provisioning.import.datasource-required', 'Please select a data source')
                : undefined
            }
            noMargin
          >
            <Controller
              name={fieldName}
              render={({ field: { ref, value, onChange, ...field } }) => {
                const dsUid =
                  value && typeof value === 'object' && 'uid' in value && typeof value.uid === 'string'
                    ? value.uid
                    : undefined;
                return (
                  <DataSourcePicker
                    {...field}
                    noDefault={true}
                    placeholder={input.info}
                    pluginId={input.pluginId}
                    current={dsUid}
                    onChange={(ds) => {
                      onChange({ uid: ds.uid, type: ds.type, name: ds.name });
                    }}
                  />
                );
              }}
              control={control}
              rules={{ required: true }}
            />
          </Field>
        );
      })}

      {/* Constant inputs */}
      {inputs.constants.map((input: DashboardInput) => {
        const fieldName = `constant-${input.name}`;
        return (
          <Field
            label={input.label}
            key={fieldName}
            invalid={!!errors[fieldName]}
            error={
              errors[fieldName]
                ? t('provisioning.import.constant-required', '{{label}} needs a value', { label: input.label })
                : undefined
            }
            noMargin
          >
            <Input {...register(fieldName, { required: true })} defaultValue={input.value} />
          </Field>
        );
      })}

      {/* Provisioning fields (branch, filename, comment) */}
      {!isLibraryPanelImportBlocked && !isReadOnlyRepo && !isOrphaned && (
        <ResourceEditFormSharedFields
          resourceType="dashboard"
          isNew
          canPushToConfiguredBranch={canPushToConfiguredBranch}
          repository={repository}
          hiddenFields={['folder']}
        />
      )}

      {error && <ProvisioningAlert error={error} />}

      {/* Actions */}
      <Stack direction="row" gap={2}>
        <Button
          type="submit"
          data-testid={selectors.components.ImportDashboardForm.submit}
          variant="primary"
          disabled={submitDisabled}
        >
          {isLoading ? t('provisioning.import.importing', 'Importing...') : t('provisioning.import.import', 'Import')}
        </Button>
        <Button type="reset" variant="secondary" onClick={onCancel}>
          <Trans i18nKey="provisioning.import.cancel">Cancel</Trans>
        </Button>
      </Stack>
    </Stack>
  );
}
