import { useEffect, useState } from 'react';
import { Controller, FieldErrors, FieldPath, UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Button, Field, FormFieldErrors, FormsOnSubmit, Stack, Input } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { DashboardInputs, DatasourceSelection, DataSourceInput, ImportFormDataV2 } from '../types';
import { validateTitle } from '../utils/validation';

interface Props extends Pick<UseFormReturn<ImportFormDataV2>, 'register' | 'control' | 'getValues' | 'watch'> {
  inputs: DashboardInputs;
  errors: FieldErrors<ImportFormDataV2>;
  onCancel: () => void;
  onSubmit: FormsOnSubmit<ImportFormDataV2>;
}

export const ImportDashboardFormV2 = ({ register, errors, control, inputs, getValues, onCancel, onSubmit }: Props) => {
  const [isSubmitted, setSubmitted] = useState(false);
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

      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput) => {
          if (input.pluginId === ExpressionDatasourceRef.type) {
            return null;
          }

          const dataSourceOption = `datasource-${input.pluginId}`;

          return (
            <Field
              label={input.name}
              description={input.description}
              key={input.pluginId}
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
                    current={selectedDataSources[input.pluginId]}
                    onChange={(ds) => {
                      field.onChange(ds);
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
