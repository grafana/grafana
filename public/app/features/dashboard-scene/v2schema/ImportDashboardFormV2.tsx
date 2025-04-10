import { useEffect, useState } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { Button, Field, FormFieldErrors, FormsOnSubmit, Stack, Input, Legend } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { DashboardInputs, DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { validateTitle } from 'app/features/manage-dashboards/utils/validation';
interface Props
  extends Pick<UseFormReturn<SaveDashboardCommand<DashboardV2Spec>>, 'register' | 'control' | 'getValues' | 'watch'> {
  inputs: DashboardInputs;
  uidReset: boolean;
  errors: FieldErrors<DashboardV2Spec>;
  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<DashboardV2Spec>;
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
  const watchDataSources = watch('dashboard');
  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && errors.title) {
      onSubmit(getValues());
    }
  }, [errors, getValues, isSubmitted, onSubmit]);

  return (
    <>
      <Legend>Options</Legend>
      <Field label="Name" invalid={!!errors.title} error={errors.title && errors.title.message}>
        <Input type="text" data-testid={selectors.components.ImportDashboardForm.name} />
      </Field>
      <Field label="Folder">
        <Controller
          //TODO: folder in the form is not being updated
          render={({ field: { ref, value, onChange, ...field } }) => (
            <FolderPicker
              {...field}
              onChange={(uid, title) => {
                console.log({ uid, title });
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
        inputs.dataSources.map((input: DataSourceInput, index: number) => {
          if (input.pluginId === ExpressionDatasourceRef.type) {
            return null;
          }
          const dataSourceOption = `dataSources.${index}` as const;
          const current = watchDataSources ?? [];
          return (
            <Field
              label={input.label}
              description={input.description}
              key={dataSourceOption}
              // invalid={errors}
              error={errors && 'A data source is required'}
            >
              <Controller
                name={dataSourceOption}
                render={({ field: { ref, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    noDefault={true}
                    placeholder={input.info}
                    pluginId={input.pluginId}
                    current={current[index]?.uid}
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
          Cancel
        </Button>
      </Stack>
    </>
  );
};

function getButtonVariant(errors: FormFieldErrors<SaveDashboardCommand<DashboardV2Spec>>) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'destructive' : 'primary';
}

function getButtonText(errors: FormFieldErrors<SaveDashboardCommand<DashboardV2Spec>>) {
  return errors && (errors.dashboard?.title || errors.k8s?.name) ? 'Import (Overwrite)' : 'Import';
}
