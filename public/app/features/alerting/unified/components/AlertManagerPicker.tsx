import { SelectableValue } from '@grafana/data';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { getAllDataSources } from '../utils/config';

interface Props {
  onChange: (alertManagerSourceName: string) => void;
  current?: string;
}

export const AlertManagerPicker: FC<Props> = ({ onChange, current }) => {
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
    <Select
      className="ds-picker select-container"
      isMulti={false}
      isClearable={false}
      backspaceRemovesValue={false}
      onChange={(value) => value.value && onChange(value.value)}
      options={options}
      maxMenuHeight={500}
      noOptionsMessage="No datasources found"
      value={current}
      getOptionLabel={(o) => o.label}
    />
  );
};
