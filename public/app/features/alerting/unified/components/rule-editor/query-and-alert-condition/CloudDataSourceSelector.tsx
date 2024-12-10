import { css } from '@emotion/css';
import { Controller, useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Field, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
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
    watch,
  } = useFormContext<RuleFormValues>();

  const styles = useStyles2(getStyles);
  const ruleFormType = watch('type');

  return (
    <>
      <div className={styles.flexRow}>
        {(ruleFormType === RuleFormType.cloudAlerting || ruleFormType === RuleFormType.cloudRecording) && (
          <Field
            className={styles.formInput}
            label={disabled ? 'Data source' : 'Select data source'}
            error={errors.dataSourceName?.message}
            invalid={!!errors.dataSourceName?.message}
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
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  formInput: css({
    width: '330px',
    '& + &': {
      marginLeft: theme.spacing(3),
    },
  }),
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  }),
});
