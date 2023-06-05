import React, { SyntheticEvent } from 'react';

import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';

import { useUniqueId } from '../../influxdb/components/useUniqueId';
import { OpenTsdbOptions } from '../types';

const { Select, Input } = LegacyForms;

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

  const idSuffix = useUniqueId();

  return (
    <>
      <h5>OpenTSDB settings</h5>
      <div className="gf-form">
        <InlineFormLabel width={7} htmlFor={`select-version-${idSuffix}`}>
          Version
        </InlineFormLabel>
        <Select
          inputId={`select-version-${idSuffix}`}
          options={tsdbVersions}
          value={tsdbVersions.find((version) => version.value === value.jsonData.tsdbVersion) ?? tsdbVersions[0]}
          onChange={onSelectChangeHandler('tsdbVersion', value, onChange)}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={7} htmlFor={`select-resolution-${idSuffix}`}>
          Resolution
        </InlineFormLabel>
        <Select
          inputId={`select-resolution-${idSuffix}`}
          options={tsdbResolutions}
          value={
            tsdbResolutions.find((resolution) => resolution.value === value.jsonData.tsdbResolution) ??
            tsdbResolutions[0]
          }
          onChange={onSelectChangeHandler('tsdbResolution', value, onChange)}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={7} htmlFor={`lookup-input-${idSuffix}`}>
          Lookup limit
        </InlineFormLabel>
        <Input
          id={`lookup-input-${idSuffix}`}
          type="number"
          value={value.jsonData.lookupLimit ?? 1000}
          onChange={onInputChangeHandler('lookupLimit', value, onChange)}
        />
      </div>
    </>
  );
};

const onSelectChangeHandler =
  (key: keyof OpenTsdbOptions, value: Props['value'], onChange: Props['onChange']) => (newValue: SelectableValue) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: newValue.value,
      },
    });
  };

const onInputChangeHandler =
  (key: keyof OpenTsdbOptions, value: Props['value'], onChange: Props['onChange']) =>
  (event: SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: event.currentTarget.value,
      },
    });
  };
