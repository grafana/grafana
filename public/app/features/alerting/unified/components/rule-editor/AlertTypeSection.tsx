import React, { FC, useState, useEffect, useCallback } from 'react';
import { DataSourceInstanceSettings, GrafanaTheme, SelectableValue } from '@grafana/data';
import { Cascader, Field, Input, InputControl, stylesFactory, Select, CascaderOption } from '@grafana/ui';
import { config } from 'app/core/config';
import { css } from '@emotion/css';

import { fetchRulerRules } from '../../api/ruler';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { DataSourcePicker, DataSourcePickerProps } from '@grafana/runtime';
import { RulesDataSourceTypes } from '../../utils/datasource';

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

const AlertTypeSection: FC = () => {
  const styles = getStyles(config.theme);

  const { register, control, watch, errors } = useFormContext<RuleFormValues>();

  const alertType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const folderOptions = useFolderSelectOptions(dataSourceName);

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
      if (alertType === RuleFormType.threshold) {
        return !!ds.meta.alerting;
      } else {
        return RulesDataSourceTypes.includes(ds.type);
      }
    },
    [alertType]
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
            onChange={(values: SelectableValue[]) => values[0]?.value}
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
              console.log('pick', ds);
              return ds[0]?.name ?? null;
            }}
          />
        </Field>
      </div>
      <Field className={styles.formInput}>
        <InputControl
          as={Cascader}
          displayAllSelectedLevels={true}
          separator=" > "
          name="folder"
          options={folderOptions}
          control={control}
          changeOnSelect={false}
          onSelect={(value: any) => {
            console.log('sel', value);
          }}
        />
      </Field>
    </RuleEditorSection>
  );
};

const useFolderSelectOptions = (dataSourceName: string | null) => {
  const [folderOptions, setFolderOptions] = useState<CascaderOption[]>([]);

  useEffect(() => {
    if (dataSourceName) {
      fetchRulerRules(dataSourceName)
        .then((namespaces) => {
          const options: CascaderOption[] = Object.entries(namespaces).map(([namespace, group]) => {
            return {
              label: namespace,
              value: namespace,
              items: group.map(({ name }) => {
                return { label: name, value: { namespace, group: name } };
              }),
            };
          });
          setFolderOptions(options);
        })
        .catch((error) => {
          if (error.status === 404) {
            setFolderOptions([{ label: 'No folders found', value: '' }]);
          }
        });
    }
  }, [dataSourceName]);

  return folderOptions;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
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
  };
});

export default AlertTypeSection;
