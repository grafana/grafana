import { Controller, useFormContext } from 'react-hook-form';

import {
  type DataSourcesWithValidRecordingTargetByUidResult,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
} from '@grafana/alerting/internal';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { type ImportFormValues } from '../types';

interface YamlTargetDataSourceFieldProps {
  recordingTargets: DataSourcesWithValidRecordingTargetByUidResult;
}

/** The data source the rules of an uploaded YAML file run against. Rules from a data source use that one. */
export function YamlTargetDataSourceField({ recordingTargets }: YamlTargetDataSourceFieldProps) {
  const {
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const handleChange = (ds: DataSourceInstanceSettings, onChange: (uid: string) => void) => {
    onChange(ds.uid);
    setValue('yamlImportTargetDatasourceName', ds.name);
    if (!getValues('targetDatasourceUID') && recordingTargets.byUid.has(ds.uid)) {
      setValue('targetDatasourceUID', ds.uid);
    }
  };

  return (
    <Field
      label={t('alerting.import-to-gma.step2.yaml-target-datasource', 'Data source')}
      description={t(
        'alerting.import-to-gma.step2.yaml-target-datasource-desc',
        'Select the data source that will be queried by the imported rules. Make sure metrics used in the imported rules are available in this data source.'
      )}
      invalid={Boolean(errors.yamlImportTargetDatasourceUID)}
      error={errors.yamlImportTargetDatasourceUID?.message}
      htmlFor="yaml-target-data-source"
      noMargin
    >
      <Controller
        name="yamlImportTargetDatasourceUID"
        control={control}
        rules={{
          required: {
            value: true,
            message: t('alerting.import-to-gma.step2.yaml-target-datasource-required', 'Please select a data source'),
          },
        }}
        render={({ field: { onChange, ref, value, ...field } }) => (
          <DataSourcePicker
            {...field}
            current={value}
            noDefault
            inputId="yaml-target-data-source"
            alerting
            disabled={recordingTargets.isLoading}
            filter={(ds) => isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type)}
            onChange={(ds) => handleChange(ds, onChange)}
            width={40}
          />
        )}
      />
    </Field>
  );
}
