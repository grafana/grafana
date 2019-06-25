// Libraries
import React, { ChangeEvent, useState, useCallback } from 'react';

// Components
import { FormField } from '../FormField/FormField';
import { FormLabel } from '../FormLabel/FormLabel';
import { UnitPicker } from '../UnitPicker/UnitPicker';

// Types
import { Field } from '../../types/data';
import { toIntegerOrUndefined } from '@grafana/data';
import { SelectOptionItem } from '../Select/Select';

import { VAR_SERIES_NAME, VAR_FIELD_NAME, VAR_CALC, VAR_CELL_PREFIX } from '../../utils/fieldDisplay';

const labelWidth = 6;

export interface Props {
  showMinMax: boolean;
  value: Partial<Field>;
  onChange: (value: Partial<Field>, event?: React.SyntheticEvent<HTMLElement>) => void;
}

export const FieldPropertiesEditor: React.FC<Props> = ({ value, onChange, showMinMax }) => {
  const { unit, title } = value;

  const [decimals, setDecimals] = useState(
    value.decimals !== undefined && value.decimals !== null ? value.decimals.toString() : ''
  );
  const [min, setMin] = useState(value.min !== undefined && value.min !== null ? value.min.toString() : '');
  const [max, setMax] = useState(value.max !== undefined && value.max !== null ? value.max.toString() : '');

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

  const onUnitChange = (unit: SelectOptionItem<string>) => {
    onChange({ ...value, unit: unit.value });
  };

  const commitChanges = useCallback(() => {
    onChange({
      ...value,
      decimals: toIntegerOrUndefined(decimals),
      min: toIntegerOrUndefined(min),
      max: toIntegerOrUndefined(max),
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
    </>
  );
};
