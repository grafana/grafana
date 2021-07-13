import React, { FC, useMemo } from 'react';
import { DataSourceInstanceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Input, InputControl, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { RuleFolderPicker } from './RuleFolderPicker';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { contextSrv } from 'app/core/services/context_srv';
import { CloudRulesSourcePicker } from './CloudRulesSourcePicker';

interface Props {
  editingExistingRule: boolean;
}

export const AlertTypeStep: FC<Props> = ({ editingExistingRule }) => {
  const styles = useStyles2(getStyles);

  const {
    register,
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues & { location?: string }>();

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');

  const alertTypeOptions = useMemo((): SelectableValue[] => {
    const result = [
      {
        label: 'Grafana managed alert',
        value: RuleFormType.grafana,
        description: 'Classic Grafana alerts based on thresholds.',
      },
    ];

    if (contextSrv.isEditor) {
      result.push({
        label: 'Cortex/Loki managed alert',
        value: RuleFormType.cloud,
        description: 'Alert based on a system or application behavior. Based on Prometheus.',
      });
    }

    return result;
  }, []);

  return (
    <RuleEditorSection stepNo={1} title="Alert type">
      <Field
        className={styles.formInput}
        label="Alert name"
        error={errors?.name?.message}
        invalid={!!errors.name?.message}
      >
        <Input
          id="name"
          {...register('name', { required: { value: true, message: 'Must enter an alert name' } })}
          autoFocus={true}
        />
      </Field>
      <div className={styles.flexRow}>
        <Field
          disabled={editingExistingRule}
          label="Alert type"
          className={styles.formInput}
          error={errors.type?.message}
          invalid={!!errors.type?.message}
          data-testid="alert-type-picker"
        >
          <InputControl
            render={({ field: { onChange, ref, ...field } }) => (
              <Select {...field} options={alertTypeOptions} onChange={(v: SelectableValue) => onChange(v?.value)} />
            )}
            name="type"
            control={control}
            rules={{
              required: { value: true, message: 'Please select alert type' },
            }}
          />
        </Field>
        {ruleFormType === RuleFormType.cloud && (
          <Field
            className={styles.formInput}
            label="Select data source"
            error={errors.dataSourceName?.message}
            invalid={!!errors.dataSourceName?.message}
            data-testid="datasource-picker"
          >
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <CloudRulesSourcePicker
                  {...field}
                  onChange={(ds: DataSourceInstanceSettings) => {
                    // reset location if switching data sources, as different rules source will have different groups and namespaces
                    setValue('location', undefined);
                    onChange(ds?.name ?? null);
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
      {ruleFormType === RuleFormType.cloud && dataSourceName && (
        <GroupAndNamespaceFields dataSourceName={dataSourceName} />
      )}
      {ruleFormType === RuleFormType.grafana && (
        <Field
          label="Folder"
          className={styles.formInput}
          error={errors.folder?.message}
          invalid={!!errors.folder?.message}
          data-testid="folder-picker"
        >
          <InputControl
            render={({ field: { ref, ...field } }) => (
              <RuleFolderPicker {...field} enableCreateNew={true} enableReset={true} />
            )}
            name="folder"
            rules={{
              required: { value: true, message: 'Please select a folder' },
            }}
          />
        </Field>
      )}
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  formInput: css`
    width: 330px;
    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
});
