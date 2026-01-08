import { SyntheticEvent, useId } from 'react';

import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { Select, Input, Field, FieldSet } from '@grafana/ui';

import { OpenTsdbOptions } from '../types';

const tsdbVersions = [
  { label: '<=2.1', value: 1 },
  { label: '==2.2', value: 2 },
  { label: '==2.3', value: 3 },
  { label: '==2.4', value: 4 },
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

  const idSuffix = useId();

  return (
    <>
      <FieldSet label="OpenTSDB settings">
        <Field htmlFor={`select-version-${idSuffix}`} label="Version">
          <Select
            inputId={`select-version-${idSuffix}`}
            options={tsdbVersions}
            value={tsdbVersions.find((version) => version.value === value.jsonData.tsdbVersion) ?? tsdbVersions[0]}
            onChange={onSelectChangeHandler('tsdbVersion', value, onChange)}
            width={20}
          />
        </Field>
        <Field htmlFor={`select-resolution-${idSuffix}`} label="Resolution">
          <Select
            inputId={`select-resolution-${idSuffix}`}
            options={tsdbResolutions}
            value={
              tsdbResolutions.find((resolution) => resolution.value === value.jsonData.tsdbResolution) ??
              tsdbResolutions[0]
            }
            onChange={onSelectChangeHandler('tsdbResolution', value, onChange)}
            width={20}
          />
        </Field>
        <Field htmlFor={`lookup-input-${idSuffix}`} label="Lookup limit">
          <Input
            id={`lookup-input-${idSuffix}`}
            type="number"
            value={value.jsonData.lookupLimit ?? 1000}
            onChange={onInputChangeHandler('lookupLimit', value, onChange)}
            width={20}
          />
        </Field>
      </FieldSet>
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
