import React, { FC, useCallback, useEffect } from 'react';
import { DataSourceInstanceSettings, GrafanaTheme, SelectableValue } from '@grafana/data';
import { Field, Input, InputControl, Select, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';

import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { DataSourcePicker, DataSourcePickerProps } from '@grafana/runtime';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { RuleGroupPicker } from '../RuleGroupPicker';
import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

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

  register({ name: 'folder' });

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const folder = watch('folder');

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
        <Input ref={register({ required: { value: true, message: 'Must enter an alert name' } })} name="name" />
      </Field>
      <div className={styles.flexRow}>
        <Field label="Alert type" className={styles.formInput} error={errors.type?.message}>
          <InputControl
            as={Select}
            name="type"
            options={alertTypeOptions}
            control={control}
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
        <Field className={styles.formInput} label="Select data source">
          <InputControl
            as={DataSourcePicker as React.ComponentType<Omit<DataSourcePickerProps, 'current'>>}
            valueName="current"
            filter={dataSourceFilter}
            name="dataSourceName"
            noDefault={true}
            control={control}
            alerting={true}
            onChange={(ds: DataSourceInstanceSettings[]) => {
              // reset location if switching data sources, as differnet rules source will have different groups and namespaces
              setValue('location', undefined);
              return ds[0]?.name ?? null;
            }}
          />
        </Field>
      </div>
      {ruleFormType === RuleFormType.system && (
        <Field label="Group" className={styles.formInput} key={dataSourceName || 'null'}>
          {dataSourceName ? (
            <InputControl as={RuleGroupPicker} name="location" control={control} dataSourceName={dataSourceName} />
          ) : (
            <Select placeholder="Select a data source first" onChange={() => {}} disabled={true} />
          )}
        </Field>
      )}
      {ruleFormType === RuleFormType.threshold && (
        <Field label="Folder" className={styles.formInput}>
          <FolderPicker
            initialTitle={folder?.title}
            initialFolderId={folder?.id}
            enableCreateNew={true}
            enableReset={true}
            onChange={(folder) => setValue('folder', folder)}
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
