import { useEffect, useState } from 'react';
import { Controller, type FieldErrors, type FieldPath, type UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Button, Field, type FormFieldErrors, type FormsOnSubmit, Stack, Input, Alert } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import {
  type DashboardInput,
  type DashboardInputs,
  type DatasourceSelection,
  type DataSourceInput,
  type ImportFormDataV2,
} from '../../types';
import { getUidFieldDescription, getUidFieldLabel } from '../utils/uidFieldText';
import { validateTitle, validateUid } from '../utils/validation';

interface Props extends Pick<UseFormReturn<ImportFormDataV2>, 'register' | 'control' | 'getValues' | 'watch'> {
  inputs: DashboardInputs;
  errors: FieldErrors<ImportFormDataV2>;
  onCancel: () => void;
  onSubmit: FormsOnSubmit<ImportFormDataV2>;
  hasFloatGridItems: boolean;
}

export const ImportDashboardFormV2 = ({
  register,
  errors,
  control,
  inputs,
  getValues,
  onCancel,
  onSubmit,
  hasFloatGridItems,
}: Props) => {
  const [isSubmitted, setSubmitted] = useState(false);
  const [uidReset, setUidReset] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<Record<string, DatasourceSelection>>({});

  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && (errors.dashboard?.title || errors.k8s?.name)) {
      const formValues = getValues();
      onSubmit({
        ...formValues,
        dashboard: {
          ...formValues.dashboard,
          title: formValues.dashboard.title,
        },
      });
    }
  }, [errors, getValues, isSubmitted, onSubmit]);

  return (
    <Stack direction="column" gap={2}>
      <Field
        label={t('manage-dashboards.import-dashboard-form.label-name', 'Name')}
        invalid={!!errors.dashboard?.title}
        error={errors.dashboard?.title && errors.dashboard?.title.message}
        noMargin
      >
        <Input
          {...register('dashboard.title', {
            required: 'Name is required',
            validate: async (v) => await validateTitle(String(v ?? ''), getValues().folderUid ?? ''),
          })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>

      <Field label={t('dashboard-scene.import-dashboard-form-v2.label-folder', 'Folder')} noMargin>
        <Controller
          render={({ field: { ref, value, onChange, ...field } }) => (
            <FolderPicker
              {...field}
              onChange={(uid, title) => {
                onChange(uid, title);
              }}
              value={value}
            />
          )}
          name="folderUid"
          control={control}
        />
      </Field>

      <Field
        label={getUidFieldLabel()}
        description={getUidFieldDescription()}
        invalid={!!errors.k8s?.name}
        error={errors.k8s?.name?.message}
        noMargin
      >
        <>
          {!uidReset ? (
            <Input
              disabled
              {...register('k8s.name', {
                validate: async (v) => (!v ? true : await validateUid(String(v))),
              })}
              addonAfter={
                !uidReset && (
                  <Button type="button" onClick={() => setUidReset(true)}>
                    <Trans i18nKey="manage-dashboards.import-dashboard-form.change-uid">Change uid</Trans>
                  </Button>
                )
              }
            />
          ) : (
            <Input
              {...register('k8s.name', {
                validate: async (v) => (!v ? true : await validateUid(String(v))),
              })}
            />
          )}
        </>
      </Field>

      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput) => {
          if (input.pluginId === ExpressionDatasourceRef.type) {
            return null;
          }

          const dataSourceOption = `datasource-${input.name}`;

          return (
            <Field
              label={input.name}
              description={input.description}
              key={dataSourceOption}
              invalid={!!errors[dataSourceOption]}
              error={errors[dataSourceOption] ? 'Please select a data source' : undefined}
              noMargin
            >
              <Controller<ImportFormDataV2, FieldPath<ImportFormDataV2>>
                name={dataSourceOption}
                render={({ field: { ref, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    noDefault={true}
                    placeholder={input.info}
                    pluginId={input.pluginId}
                    current={selectedDataSources[dataSourceOption]}
                    onChange={(ds) => {
                      field.onChange(ds);
                      setSelectedDataSources((prev) => ({
                        ...prev,
                        [dataSourceOption]: {
                          uid: ds.uid,
                          type: ds.type,
                          name: ds.name,
                        },
                      }));
                    }}
                  />
                )}
                control={control}
                rules={{ required: true }}
              />
            </Field>
          );
        })}

      {inputs.constants &&
        inputs.constants.map((input: DashboardInput) => {
          const constantKey = `constant-${input.name}`;
          return (
            <Field
              label={input.label}
              key={constantKey}
              invalid={!!errors[constantKey]}
              error={errors[constantKey] ? `${input.label} needs a value` : undefined}
              noMargin
            >
              <Input {...register(constantKey, { required: true })} defaultValue={input.value} />
            </Field>
          );
        })}

      {hasFloatGridItems && (
        <Alert
          severity="warning"
          title={t('dashboard-scene.import-dashboard-form-v2.float-grid-items-warning-title', 'Floating grid items')}
          data-testid={selectors.components.ImportDashboardForm.floatGridItemsWarning}
        >
          <Trans i18nKey="dashboard-scene.import-dashboard-form-v2.float-grid-items-warning-body">
            The dashboard contains grid items with floating positions. This is not supported by Grafana and the numbers
            will be truncated to integers.
          </Trans>
        </Alert>
      )}

      <Stack direction="row" gap={2}>
        <Button
          type="submit"
          data-testid={selectors.components.ImportDashboardForm.submit}
          variant={getButtonVariant(errors)}
          onClick={() => {
            setSubmitted(true);
          }}
        >
          {getButtonText(errors)}
        </Button>
        <Button type="reset" variant="secondary" onClick={onCancel}>
          <Trans i18nKey="dashboard-scene.import-dashboard-form-v2.cancel">Cancel</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};

function getButtonVariant(errors: FormFieldErrors<ImportFormDataV2>) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'destructive' : 'primary';
}

function getButtonText(errors: FormFieldErrors<ImportFormDataV2>) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'Import (Overwrite)' : 'Import';
}
