import React from 'react';
import { FormLabel, Select } from '@grafana/ui';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { OpenTsdbOptions } from '../types';

const tsdbVersions = [
  { label: '<=2.1', value: 1 },
  { label: '==2.2', value: 2 },
  { label: '==2.3', value: 3 },
];

const tsdbResolutions = [
  { label: 'second', value: 1 },
  { label: 'millisecond', value: 2 },
];

interface Props {
  value: DataSourceSettings<OpenTsdbOptions>;
  onChange: (value: DataSourceSettings<OpenTsdbOptions>) => void;
}

export const OpenTsdbDetails = (props: Props) => {
  const { onChange, value } = props;

  return (
    <>
      <h5>OpenTSDB settings</h5>
      <div className="gf-form">
        <FormLabel width={7}>Version</FormLabel>
        <Select
          options={tsdbVersions}
          value={tsdbVersions.find(version => version.value === value.jsonData.tsdbVersion) ?? tsdbVersions[0]}
          onChange={onChangeHandler('tsdbVersion', value, onChange)}
        />
      </div>
      <div className="gf-form">
        <FormLabel width={7}>Resolution</FormLabel>
        <Select
          options={tsdbResolutions}
          value={
            tsdbResolutions.find(resolution => resolution.value === value.jsonData.tsdbResolution) ?? tsdbResolutions[0]
          }
          onChange={onChangeHandler('tsdbResolution', value, onChange)}
        />
      </div>
    </>
  );
};

const onChangeHandler = (key: keyof OpenTsdbOptions, value: Props['value'], onChange: Props['onChange']) => (
  newValue: SelectableValue
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: newValue.value,
    },
  });
};
