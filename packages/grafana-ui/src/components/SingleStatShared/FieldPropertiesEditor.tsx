// Libraries
import React, { ChangeEvent, useState, useCallback } from 'react';

// Components
import { FormField } from '../FormField/FormField';
import { FormLabel } from '../FormLabel/FormLabel';
import { UnitPicker } from '../UnitPicker/UnitPicker';

// Types
import {
  VAR_SERIES_NAME,
  VAR_FIELD_NAME,
  VAR_CALC,
  VAR_CELL_PREFIX,
  toIntegerOrUndefined,
  FieldConfig,
  toFloatOrUndefined,
  toNumberString,
} from '@grafana/data';

const labelWidth = 6;

export interface Props {
  showMinMax?: boolean;
  showTitle?: boolean;
  value: FieldConfig;
  onChange: (value: FieldConfig, event?: React.SyntheticEvent<HTMLElement>) => void;
}

export const FieldPropertiesEditor: React.FC<Props> = ({ value, onChange, showMinMax, showTitle }) => {
  const { unit, title } = value;

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

  const onUnitChange = (unit?: string) => {
    onChange({ ...value, unit });
  };

  const commitChanges = useCallback(() => {
    onChange({
      ...value,
      decimals: toIntegerOrUndefined(decimals),
      min: toFloatOrUndefined(min),
      max: toFloatOrUndefined(max),
    });
  }, [min, max, decimals, value]);

  const titleTooltip = (
    <div>
      Template Variables:
      <br />
      {'${' + VAR_SERIES_NAME + '}'}
      <br />
      {'${' + VAR_FIELD_NAME + '}'}
      <br />
      {'$' + VAR_CELL_PREFIX + '{N}'} / {'$' + VAR_CALC}
    </div>
  );

  return (
    <>
      {showTitle && (
        <FormField
          label="Title"
          labelWidth={labelWidth}
          onChange={onTitleChange}
          value={title}
          tooltip={titleTooltip}
          placeholder="Auto"
          aria-label="Field properties editor title input"
        />
      )}

      <div className="gf-form">
        <FormLabel width={labelWidth}>Unit</FormLabel>
        <UnitPicker value={unit} onChange={onUnitChange} />
      </div>
      {showMinMax && (
        <>
          <FormField
            label="Min"
            labelWidth={labelWidth}
            onChange={onMinChange}
            onBlur={commitChanges}
            value={min}
            placeholder="Auto"
            type="number"
            aria-label="Field properties editor min input"
          />
          <FormField
            label="Max"
            labelWidth={labelWidth}
            onChange={onMaxChange}
            onBlur={commitChanges}
            value={max}
            type="number"
            placeholder="Auto"
            aria-label="Field properties editor max input"
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
    </>
  );
};
