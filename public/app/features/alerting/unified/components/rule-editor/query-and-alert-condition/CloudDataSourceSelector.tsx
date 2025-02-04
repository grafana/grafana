import { Controller, useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Field } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';
import { CloudRulesSourcePicker } from '../CloudRulesSourcePicker';

export interface CloudDataSourceSelectorProps {
  disabled?: boolean;
  onChangeCloudDatasource: (datasourceUid: string) => void;
}
export const CloudDataSourceSelector = ({ disabled, onChangeCloudDatasource }: CloudDataSourceSelectorProps) => {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  return (
    <Field
      label={disabled ? 'Data source' : 'Select data source'}
      error={errors.dataSourceName?.message}
      invalid={!!errors.dataSourceName?.message}
      style={{ marginBottom: 0 }}
    >
      <Controller
        render={({ field: { onChange, ref, ...field } }) => (
          <CloudRulesSourcePicker
            {...field}
            disabled={disabled}
            onChange={(ds: DataSourceInstanceSettings) => {
              // reset expression as they don't need to persist after changing datasources
              setValue('expression', '');
              onChange(ds?.name ?? null);
              onChangeCloudDatasource(ds?.uid ?? null);
            }}
          />
        )}
        name="dataSourceName"
        control={control}
        rules={{
          required: { value: true, message: 'Please select a data source' },
        }}
      />
    </Field>
  );
};
