import React, { FC, useState } from 'react';
import { FieldSet, Field, Input, stylesFactory, Select } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { config } from 'app/core/config';
import { css } from 'emotion';

import { getAllDataSources, getPromAndLokiDataSources } from '../api/datasources';

type Props = {};

enum ALERT_TYPE {
  THRESHOLD = 'threshold',
  SYSTEM = 'system',
  HOST = 'host',
}

const alertTypeOptions = [
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

const AlertTypeSection: FC<Props> = (props) => {
  const styles = getStyles(config.theme);

  const alertType = useSelect();
  const datasource = useSelect();

  const getDatasourceSelectOptions = () => {
    let thresholdOptions = [] as ReturnType<typeof getAllDataSources>;
    if (alertType.value === ALERT_TYPE.THRESHOLD) {
      thresholdOptions = getAllDataSources().filter(({ type }) => type !== 'datasource');
    } else if (alertType.value === ALERT_TYPE.SYSTEM) {
      thresholdOptions = getPromAndLokiDataSources();
    }
    return thresholdOptions.map(({ name, type }) => {
      return {
        label: name,
        value: name,
        description: type,
      };
    });
  };

  const dataSourceOptions = getDatasourceSelectOptions();

  return (
    <FieldSet label="Alert type">
      <Field className={styles.formInput} label="Alert name">
        <Input name="name" />
      </Field>
      <div className={styles.flexRow}>
        <Field label="Alert type" className={styles.formInput}>
          <Select {...alertType} options={alertTypeOptions} />
        </Field>
        <Field className={styles.formInput} label="Select data source">
          <Select {...datasource} options={dataSourceOptions} />
        </Field>
      </div>
    </FieldSet>
  );
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

const useSelect = (initialValue?: string) => {
  const [value, setValue] = useState(initialValue);
  const handleChange = (option: { value: string; label: string; description?: string }) => {
    setValue(option.value);
  };

  return { value, onChange: handleChange };
};

export default AlertTypeSection;
