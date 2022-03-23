import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import React, { FC, useMemo } from 'react';
import { Field, Select, useStyles2 } from '@grafana/ui';
import { getAllDataSources } from '../utils/config';
import { css } from '@emotion/css';

interface Props {
  onChange: (alertManagerSourceName: string) => void;
  current?: string;
  disabled?: boolean;
}

export const AlertManagerPicker: FC<Props> = ({ onChange, current, disabled = false }) => {
  const styles = useStyles2(getStyles);

  const options: Array<SelectableValue<string>> = useMemo(() => {
    return [
      {
        label: 'Grafana',
        value: GRAFANA_RULES_SOURCE_NAME,
        imgUrl: 'public/img/grafana_icon.svg',
        meta: {},
      },
      ...getAllDataSources()
        .filter((ds) => ds.type === DataSourceType.Alertmanager)
        .map((ds) => ({
          label: ds.name.substr(0, 37),
          value: ds.name,
          imgUrl: ds.meta.info.logos.small,
          meta: ds.meta,
        })),
    ];
  }, []);

  return (
    <Field
      className={styles.field}
      label={disabled ? 'Alertmanager' : 'Choose Alertmanager'}
      disabled={disabled || options.length === 1}
      data-testid="alertmanager-picker"
    >
      <Select
        aria-label={disabled ? 'Alertmanager' : 'Choose Alertmanager'}
        menuShouldPortal
        width={29}
        className="ds-picker select-container"
        backspaceRemovesValue={false}
        onChange={(value) => value.value && onChange(value.value)}
        options={options}
        maxMenuHeight={500}
        noOptionsMessage="No datasources found"
        value={current}
        getOptionLabel={(o) => o.label}
      />
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css`
    margin-bottom: ${theme.spacing(4)};
  `,
});
