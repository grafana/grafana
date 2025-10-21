import { useEffect, useState } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Button, Field, FormFieldErrors, FormsOnSubmit, Stack, Input } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { DashboardInputs, DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { validateTitle } from 'app/features/manage-dashboards/utils/validation';
interface Props
  extends Pick<
    UseFormReturn<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>,
    'register' | 'control' | 'getValues' | 'watch'
  > {
  inputs: DashboardInputs;
  uidReset: boolean;
  errors: FieldErrors<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>;
  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>;
}

export const ImportDashboardFormV2 = ({
  register,
  errors,
  control,
  inputs,
  getValues,
  uidReset,
  onUidReset,
  onCancel,
  onSubmit,
  watch,
}: Props) => {
  const [isSubmitted, setSubmitted] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<Record<string, { uid: string; type: string }>>({});
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
    <>
      <Trans i18nKey="manage-dashboards.import-dashboard-form.options">Options</Trans>
      <Field
        label={t('manage-dashboards.import-dashboard-form.label-name', 'Name')}
        invalid={!!errors.dashboard?.title}
        error={errors.dashboard?.title && errors.dashboard?.title.message}
      >
        <Input
          {...(register as any)('dashboard.title', {
            required: 'Name is required',
            validate: async (v: string) => await validateTitle(v, getValues().folderUid ?? ''),
          })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>
      <Field label={t('dashboard-scene.import-dashboard-form-v2.label-folder', 'Folder')}>
        <Controller<any>
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
      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput) => {
          if (input.pluginId === ExpressionDatasourceRef.type) {
            return null;
          }

          const dataSourceOption = `datasource-${input.pluginId}` as const;

          return (
            <Field
              label={input.pluginId}
              description={input.description}
              key={input.pluginId}
              invalid={!!errors[dataSourceOption]}
              error={errors[dataSourceOption] ? 'Please select a data source' : undefined}
            >
              <Controller<any>
                name={dataSourceOption}
                render={({ field: { ref, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    noDefault={true}
                    placeholder={input.info}
                    pluginId={input.pluginId}
                    current={selectedDataSources[input.pluginId]}
                    onChange={(ds) => {
                      field.onChange(ds);
                      // Update our selected datasources map
                      setSelectedDataSources((prev) => ({
                        ...prev,
                        [input.pluginId]: {
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

      <Stack>
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
    </>
  );
};

function getButtonVariant(
  errors: FormFieldErrors<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>
) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'destructive' : 'primary';
}

function getButtonText(
  errors: FormFieldErrors<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>
) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'Import (Overwrite)' : 'Import';
}
