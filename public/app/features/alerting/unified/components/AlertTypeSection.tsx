import React, { FC, useState, useEffect } from 'react';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { FieldSet, Field, Input, InputControl, stylesFactory, Select, FormAPI } from '@grafana/ui';
import { config } from 'app/core/config';
import { css } from 'emotion';

import { getAllDataSources, getPromAndLokiDataSources } from '../utils/config';
import { fetchRulerRules } from '../api/ruler';

interface Props extends FormAPI<any> {}

enum ALERT_TYPE {
  THRESHOLD = 'threshold',
  SYSTEM = 'system',
  HOST = 'host',
}

const alertTypeOptions: SelectableValue[] = [
  {
    label: 'Threshold',
    value: ALERT_TYPE.THRESHOLD,
    description: 'Metric alert based on a defined threshold',
  },
  {
    label: 'System or application',
    value: ALERT_TYPE.SYSTEM,
    description: 'Alert based on a system or application behavior. Based on Prometheus.',
  },
  {
    label: 'Host',
    value: ALERT_TYPE.HOST,
    description: 'Alert based on a Synthetic Monitoring check',
  },
];

const AlertTypeSection: FC<Props> = ({ register, control, watch }) => {
  const styles = getStyles(config.theme);

  const alertType = watch('type') as SelectableValue;
  const datasource = watch('datasource') as SelectableValue;
  const dataSourceOptions = useDatasourceSelectOptions(alertType);
  const folderOptions = useFolderSelectOptions(datasource);

  return (
    <FieldSet label="Alert type">
      <Field className={styles.formInput} label="Alert name">
        <Input ref={register({ required: true })} name="name" />
      </Field>
      <div className={styles.flexRow}>
        <Field label="Alert type" className={styles.formInput}>
          <InputControl as={Select} name="type" options={alertTypeOptions} control={control} />
        </Field>
        <Field className={styles.formInput} label="Select data source">
          <InputControl as={Select} name="datasource" options={dataSourceOptions} control={control} />
        </Field>
      </div>
      <Field className={styles.formInput}>
        <InputControl as={Select} name="folder" options={folderOptions} control={control} />
      </Field>
    </FieldSet>
  );
};

const useDatasourceSelectOptions = (alertType: SelectableValue) => {
  const [datasourceOptions, setDataSourceOptions] = useState<SelectableValue[]>([]);

  useEffect(() => {
    let options = [] as ReturnType<typeof getAllDataSources>;
    if (alertType?.value === ALERT_TYPE.THRESHOLD) {
      options = getAllDataSources().filter(({ type }) => type !== 'datasource');
    } else if (alertType?.value === ALERT_TYPE.SYSTEM) {
      options = getPromAndLokiDataSources();
    }
    setDataSourceOptions(
      options.map(({ name, type }) => {
        return {
          label: name,
          value: name,
          description: type,
        };
      })
    );
  }, [alertType?.value]);

  return datasourceOptions;
};

const useFolderSelectOptions = (datasource: SelectableValue) => {
  const [folderOptions, setFolderOptions] = useState<SelectableValue[]>([]);

  useEffect(() => {
    if (datasource?.value) {
      fetchRulerRules(datasource?.value).then((namespaces) => {
        console.log(namespaces);
        const options = Object.entries(namespaces).flatMap(([namespace, group]) => {
          return group.map(({ name }) => {
            return { label: `${namespace} > ${name}`, value: [namespace, name] };
          });
        });
        setFolderOptions(options);
      });
    }
  }, [datasource?.value]);

  return folderOptions;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    formInput: css`
      width: 400px;
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
