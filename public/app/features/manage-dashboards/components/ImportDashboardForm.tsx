import { useEffect, useState } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Button, Field, FormFieldErrors, FormsOnSubmit, Stack, Input, Legend } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import {
  DashboardInput,
  DashboardInputs,
  DataSourceInput,
  ImportDashboardDTO,
  LibraryPanelInputState,
} from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';

import { ImportDashboardLibraryPanelsList } from './ImportDashboardLibraryPanelsList';

interface Props extends Pick<UseFormReturn<ImportDashboardDTO>, 'register' | 'control' | 'getValues' | 'watch'> {
  uidReset: boolean;
  inputs: DashboardInputs;
  errors: FieldErrors<ImportDashboardDTO>;
  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<ImportDashboardDTO>;
}

export const ImportDashboardForm = ({
  register,
  errors,
  control,
  getValues,
  uidReset,
  inputs,
  onUidReset,
  onCancel,
  onSubmit,
  watch,
}: Props) => {
  const [isSubmitted, setSubmitted] = useState(false);
  const watchDataSources = watch('dataSources');
  const watchFolder = watch('folder');

  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && (errors.title || errors.uid)) {
      onSubmit(getValues());
    }
  }, [errors, getValues, isSubmitted, onSubmit]);

  const newLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.New) ?? [];
  const existingLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.Exists) ?? [];

  return (
    <>
      <Legend>
        <Trans i18nKey="manage-dashboards.import-dashboard-form.options">Options</Trans>
      </Legend>
      <Field
        label={t('manage-dashboards.import-dashboard-form.label-name', 'Name')}
        invalid={!!errors.title}
        error={errors.title && errors.title.message}
      >
        <Input
          {...register('title', {
            required: 'Name is required',
            validate: async (v: string) => await validateTitle(v, getValues().folder.uid),
          })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>
      <Field label={t('manage-dashboards.import-dashboard-form.label-folder', 'Folder')}>
        <Controller
          render={({ field: { ref, value, onChange, ...field } }) => (
            <FolderPicker {...field} onChange={(uid, title) => onChange({ uid, title })} value={value.uid} />
          )}
          name="folder"
          control={control}
        />
      </Field>
      <Field
        label={t('manage-dashboards.import-dashboard-form.label-unique-identifier-uid', 'Unique identifier (UID)')}
        description={t(
          'manage-dashboards.import-dashboard-form.description-unique-identifier-uid',
          'The unique identifier (UID) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs. The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any bookmarked links to that dashboard.'
        )}
        invalid={!!errors.uid}
        error={errors.uid && errors.uid.message}
      >
        <>
          {!uidReset ? (
            <Input
              disabled
              {...register('uid', { validate: async (v: string) => await validateUid(v) })}
              addonAfter={
                !uidReset && (
                  <Button onClick={onUidReset}>
                    <Trans i18nKey="manage-dashboards.import-dashboard-form.change-uid">Change uid</Trans>
                  </Button>
                )
              }
            />
          ) : (
            <Input {...register('uid', { required: true, validate: async (v: string) => await validateUid(v) })} />
          )}
        </>
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
              invalid={errors.dataSources && !!errors.dataSources[index]}
              error={errors.dataSources && errors.dataSources[index] && 'A data source is required'}
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
      {inputs.constants &&
        inputs.constants.map((input: DashboardInput, index) => {
          const constantIndex = `constants.${index}` as const;
          return (
            <Field
              label={input.label}
              error={errors.constants && errors.constants[index] && `${input.label} needs a value`}
              invalid={errors.constants && !!errors.constants[index]}
              key={constantIndex}
            >
              <Input {...register(constantIndex, { required: true })} defaultValue={input.value} />
            </Field>
          );
        })}
      <ImportDashboardLibraryPanelsList
        inputs={newLibraryPanels}
        label={t('manage-dashboards.import-dashboard-form.label-new-library-panels', 'New library panels')}
        description={t(
          'manage-dashboards.import-dashboard-form.description-library-panels-imported',
          'List of new library panels that will get imported.'
        )}
        folderName={watchFolder.title}
      />
      <ImportDashboardLibraryPanelsList
        inputs={existingLibraryPanels}
        label={t('manage-dashboards.import-dashboard-form.label-existing-library-panels', 'Existing library panels')}
        description={t(
          'manage-dashbaords.import-dashboard-form.description-existing-library-panels',
          'List of existing library panels. These panels are not affected by the import.'
        )}
        folderName={watchFolder.title}
      />
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
          <Trans i18nKey="manage-dashboards.import-dashboard-form.cancel">Cancel</Trans>
        </Button>
      </Stack>
    </>
  );
};

function getButtonVariant(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'destructive' : 'primary';
}

function getButtonText(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'Import (Overwrite)' : 'Import';
}
