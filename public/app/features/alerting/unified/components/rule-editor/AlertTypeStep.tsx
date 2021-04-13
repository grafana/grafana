import React, { FC, useCallback, useEffect } from 'react';
import { DataSourceInstanceSettings, GrafanaTheme, SelectableValue } from '@grafana/data';
import { Field, Input, InputControl, Select, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';

import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { DataSourcePicker, DataSourcePickerProps } from '@grafana/runtime';
import { RuleGroupPicker } from '../RuleGroupPicker';
import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';
import { RuleFolderPicker } from './RuleFolderPicker';

const alertTypeOptions: SelectableValue[] = [
  {
    label: 'Threshold',
    value: RuleFormType.threshold,
    description: 'Metric alert based on a defined threshold',
  },
  {
    label: 'System or application',
    value: RuleFormType.system,
    description: 'Alert based on a system or application behavior. Based on Prometheus.',
  },
];

export const AlertTypeStep: FC = () => {
  const styles = useStyles(getStyles);

  const { register, control, watch, errors, setValue } = useFormContext<RuleFormValues>();

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');

  useEffect(() => {}, [ruleFormType]);

  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
      if (ruleFormType === RuleFormType.threshold) {
        return !!ds.meta.alerting;
      } else {
        // filter out only rules sources that support ruler and thus can have alerts edited
        return !!rulesSourcesWithRuler.find(({ id }) => id === ds.id);
      }
    },
    [ruleFormType, rulesSourcesWithRuler]
  );

  return (
    <RuleEditorSection stepNo={1} title="Alert type">
      <Field
        className={styles.formInput}
        label="Alert name"
        error={errors?.name?.message}
        invalid={!!errors.name?.message}
      >
        <Input
          autoFocus={true}
          ref={register({ required: { value: true, message: 'Must enter an alert name' } })}
          name="name"
        />
      </Field>
      <div className={styles.flexRow}>
        <Field
          label="Alert type"
          className={styles.formInput}
          error={errors.type?.message}
          invalid={!!errors.type?.message}
        >
          <InputControl
            as={Select}
            name="type"
            options={alertTypeOptions}
            control={control}
            rules={{
              required: { value: true, message: 'Please select alert type' },
            }}
            onChange={(values: SelectableValue[]) => {
              const value = values[0]?.value;
              // when switching to system alerts, null out data source selection if it's not a rules source with ruler
              if (
                value === RuleFormType.system &&
                dataSourceName &&
                !rulesSourcesWithRuler.find(({ name }) => name === dataSourceName)
              ) {
                setValue('dataSourceName', null);
              }
              return value;
            }}
          />
        </Field>
        <Field
          className={styles.formInput}
          label="Select data source"
          error={errors.dataSourceName?.message}
          invalid={!!errors.dataSourceName?.message}
        >
          <InputControl
            as={DataSourcePicker as React.ComponentType<Omit<DataSourcePickerProps, 'current'>>}
            valueName="current"
            filter={dataSourceFilter}
            name="dataSourceName"
            noDefault={true}
            control={control}
            alerting={true}
            rules={{
              required: { value: true, message: 'Please select a data source' },
            }}
            onChange={(ds: DataSourceInstanceSettings[]) => {
              // reset location if switching data sources, as differnet rules source will have different groups and namespaces
              setValue('location', undefined);
              return ds[0]?.name ?? null;
            }}
          />
        </Field>
      </div>
      {ruleFormType === RuleFormType.system && (
        <Field
          label="Group"
          className={styles.formInput}
          error={errors.location?.message}
          invalid={!!errors.location?.message}
        >
          {dataSourceName ? (
            <InputControl
              as={RuleGroupPicker}
              name="location"
              control={control}
              dataSourceName={dataSourceName}
              rules={{
                required: { value: true, message: 'Please select a group' },
              }}
            />
          ) : (
            <Select placeholder="Select a data source first" onChange={() => {}} disabled={true} />
          )}
        </Field>
      )}
      {ruleFormType === RuleFormType.threshold && (
        <Field
          label="Folder"
          className={styles.formInput}
          error={errors.folder?.message}
          invalid={!!errors.folder?.message}
        >
          <InputControl
            as={RuleFolderPicker}
            name="folder"
            enableCreateNew={true}
            enableReset={true}
            rules={{
              required: { value: true, message: 'Please select a folder' },
            }}
          />
        </Field>
      )}
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  formInput: css`
    width: 330px;
    & + & {
      margin-left: ${theme.spacing.sm};
    }
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
});
