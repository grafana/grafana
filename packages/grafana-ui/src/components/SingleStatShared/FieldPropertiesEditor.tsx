// Libraries
import React, { ChangeEvent, useState, useCallback } from 'react';

// Components
import { FormField } from '../FormField/FormField';
import { FormLabel } from '../FormLabel/FormLabel';
import { UnitPicker } from '../UnitPicker/UnitPicker';

// Types
import {
  toIntegerOrUndefined,
  SelectableValue,
  FieldConfig,
  toFloatOrUndefined,
  toNumberString,
  NullValueMode,
} from '@grafana/data';

import { VAR_SERIES_NAME, VAR_FIELD_NAME, VAR_CALC, VAR_CELL_PREFIX } from '../../utils/fieldDisplay';
import Select from '../Select/Select';

const labelWidth = 8;

export interface Props {
  showMinMax: boolean;
  value: FieldConfig;
  onChange: (value: FieldConfig, event?: React.SyntheticEvent<HTMLElement>) => void;
}

const nullValueModes: Array<SelectableValue<NullValueMode>> = [
  {
    value: NullValueMode.AsZero,
    label: 'As Zero',
    description: 'Show the result as zero',
  },
  {
    value: NullValueMode.Ignore,
    label: 'Ignore',
    description: 'Ignore null values.  In a graph this will look connected',
  },
  {
    value: NullValueMode.Null,
    label: 'As Null',
    description: 'Show missing values',
  },
];

export const FieldPropertiesEditor: React.FC<Props> = ({ value, onChange, showMinMax }) => {
  const { unit, title, nullValueMode } = value;

  const [decimals, setDecimals] = useState(
    value.decimals !== undefined && value.decimals !== null ? value.decimals.toString() : ''
  );
  const [min, setMin] = useState(toNumberString(value.min));
  const [max, setMax] = useState(toNumberString(value.max));

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, title: event.target.value });
  };

  const onDecimalChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDecimals(event.target.value);
    },
    [value.decimals, onChange]
  );

  const onMinChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setMin(event.target.value);
    },
    [value.min, onChange]
  );

  const onMaxChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setMax(event.target.value);
    },
    [value.max, onChange]
  );

  const onUnitChange = (unit: SelectableValue<string>) => {
    onChange({ ...value, unit: unit.value });
  };

  const onNullValueModeChange = (item: SelectableValue<NullValueMode>) => {
    onChange({ ...value, nullValueMode: item.value });
  };

  const commitChanges = useCallback(() => {
    onChange({
      ...value,
      decimals: toIntegerOrUndefined(decimals),
      min: toFloatOrUndefined(min),
      max: toFloatOrUndefined(max),
    });
  }, [min, max, decimals]);

  const titleTooltip = (
    <div>
      Template Variables:
      <br />
      {'$' + VAR_SERIES_NAME}
      <br />
      {'$' + VAR_FIELD_NAME}
      <br />
      {'$' + VAR_CELL_PREFIX + '{N}'} / {'$' + VAR_CALC}
    </div>
  );

  return (
    <>
      <FormField
        label="Title"
        labelWidth={labelWidth}
        onChange={onTitleChange}
        value={title}
        tooltip={titleTooltip}
        placeholder="Auto"
      />

      <div className="gf-form">
        <FormLabel width={labelWidth}>Unit</FormLabel>
        <UnitPicker defaultValue={unit} onChange={onUnitChange} />
      </div>
      {showMinMax && (
        <>
          <FormField
            label="Min"
            labelWidth={labelWidth}
            onChange={onMinChange}
            onBlur={commitChanges}
            value={min}
            type="number"
          />
          <FormField
            label="Max"
            labelWidth={labelWidth}
            onChange={onMaxChange}
            onBlur={commitChanges}
            value={max}
            type="number"
          />
        </>
      )}
      <FormField
        label="Decimals"
        labelWidth={labelWidth}
        placeholder="auto"
        onChange={onDecimalChange}
        onBlur={commitChanges}
        value={decimals}
        type="number"
      />

      <div className="gf-form">
        <FormLabel width={labelWidth} tooltip="How should null values be shown?">
          Null Values
        </FormLabel>
        <Select
          width={12}
          value={nullValueModes.find(v => v.value === nullValueMode)}
          isClearable={true}
          isSearchable={true}
          options={nullValueModes}
          placeholder="Auto"
          onChange={onNullValueModeChange}
        />
      </div>
    </>
  );
};
