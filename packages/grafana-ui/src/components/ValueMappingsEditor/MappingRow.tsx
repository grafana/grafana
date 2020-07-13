import React from 'react';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton, Label, RadioButtonGroup } from '../index';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { MappingType, RangeMap, SelectableValue, ValueMap, ValueMapping } from '@grafana/data';

export interface Props {
  valueMapping: ValueMapping;
  updateValueMapping: (valueMapping: ValueMapping) => void;
  removeValueMapping: () => void;
}

const MAPPING_OPTIONS: Array<SelectableValue<MappingType>> = [
  { value: MappingType.ValueToText, label: 'Value' },
  { value: MappingType.RangeToText, label: 'Range' },
];

export const MappingRow: React.FC<Props> = ({ valueMapping, updateValueMapping, removeValueMapping }) => {
  const { type } = valueMapping;

  const onMappingValueChange = (value: string) => {
    updateValueMapping({ ...valueMapping, value: value });
  };

  const onMappingFromChange = (value: string) => {
    updateValueMapping({ ...valueMapping, from: value });
  };

  const onMappingToChange = (value: string) => {
    updateValueMapping({ ...valueMapping, to: value });
  };

  const onMappingTextChange = (value: string) => {
    updateValueMapping({ ...valueMapping, text: value });
  };

  const onMappingTypeChange = (mappingType: MappingType) => {
    updateValueMapping({ ...valueMapping, type: mappingType });
  };

  const onKeyDown = (handler: (value: string) => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handler(e.currentTarget.value);
    }
  };

  const renderRow = () => {
    if (type === MappingType.RangeToText) {
      return (
        <>
          <HorizontalGroup>
            <Field label="From">
              <Input
                type="number"
                defaultValue={(valueMapping as RangeMap).from!}
                onBlur={e => onMappingFromChange(e.currentTarget.value)}
                onKeyDown={onKeyDown(onMappingFromChange)}
              />
            </Field>
            <Field label="To">
              <Input
                type="number"
                defaultValue={(valueMapping as RangeMap).to}
                onBlur={e => onMappingToChange(e.currentTarget.value)}
                onKeyDown={onKeyDown(onMappingToChange)}
              />
            </Field>
          </HorizontalGroup>

          <Field label="Text">
            <Input
              defaultValue={valueMapping.text}
              onBlur={e => onMappingTextChange(e.currentTarget.value)}
              onKeyDown={onKeyDown(onMappingTextChange)}
            />
          </Field>
        </>
      );
    }

    return (
      <>
        <Field label="Value">
          <Input
            defaultValue={(valueMapping as ValueMap).value}
            onBlur={e => onMappingValueChange(e.currentTarget.value)}
            onKeyDown={onKeyDown(onMappingValueChange)}
          />
        </Field>

        <Field label="Text">
          <Input
            defaultValue={valueMapping.text}
            onBlur={e => onMappingTextChange(e.currentTarget.value)}
            onKeyDown={onKeyDown(onMappingTextChange)}
          />
        </Field>
      </>
    );
  };

  const label = (
    <HorizontalGroup justify="space-between" align="center">
      <Label>Mapping type</Label>
      <IconButton name="times" onClick={removeValueMapping} aria-label="ValueMappingsEditor remove button" />
    </HorizontalGroup>
  );
  return (
    <div>
      <Field label={label}>
        <RadioButtonGroup
          options={MAPPING_OPTIONS}
          value={type}
          onChange={type => {
            onMappingTypeChange(type!);
          }}
        />
      </Field>
      {renderRow()}
    </div>
  );
};
