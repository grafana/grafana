import React, { ChangeEvent } from 'react';
import { HorizontalGroup } from '../Layout/Layout';
import { Select } from '../index';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { MappingType, RangeMap, ValueMap, ValueMapping } from '@grafana/data';
import * as styleMixins from '../../themes/mixins';
import { useTheme } from '../../themes';
import { FieldConfigItemHeaderTitle } from '../FieldConfigs/FieldConfigItemHeaderTitle';

export interface Props {
  valueMapping: ValueMapping;
  updateValueMapping: (valueMapping: ValueMapping) => void;
  removeValueMapping: () => void;
}

const MAPPING_OPTIONS = [
  { value: MappingType.ValueToText, label: 'Value' },
  { value: MappingType.RangeToText, label: 'Range' },
];

export const MappingRow: React.FC<Props> = ({ valueMapping, updateValueMapping, removeValueMapping }) => {
  const theme = useTheme();
  const { type } = valueMapping;

  const onMappingValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValueMapping({ ...valueMapping, value: event.target.value });
  };

  const onMappingFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValueMapping({ ...valueMapping, from: event.target.value });
  };

  const onMappingToChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValueMapping({ ...valueMapping, to: event.target.value });
  };

  const onMappingTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValueMapping({ ...valueMapping, text: event.target.value });
  };

  const onMappingTypeChange = (mappingType: MappingType) => {
    updateValueMapping({ ...valueMapping, type: mappingType });
  };

  const renderRow = () => {
    if (type === MappingType.RangeToText) {
      return (
        <>
          <HorizontalGroup>
            <Field label="From">
              <Input type="number" defaultValue={(valueMapping as RangeMap).from!} onBlur={onMappingFromChange} />
            </Field>
            <Field label="To">
              <Input type="number" defaultValue={(valueMapping as RangeMap).to} onBlur={onMappingToChange} />
            </Field>
          </HorizontalGroup>

          <Field label="Text">
            <Input defaultValue={valueMapping.text} onBlur={onMappingTextChange} />
          </Field>
        </>
      );
    }

    return (
      <>
        <Field label="Value">
          <Input type="number" defaultValue={(valueMapping as ValueMap).value} onBlur={onMappingValueChange} />
        </Field>

        <Field label="Text">
          <Input defaultValue={valueMapping.text} onBlur={onMappingTextChange} />
        </Field>
      </>
    );
  };

  const styles = styleMixins.panelEditorNestedListStyles(theme);

  return (
    <div className={styles.wrapper}>
      <FieldConfigItemHeaderTitle title="Mapping type" onRemove={removeValueMapping}>
        <div className={styles.itemContent}>
          <Select
            placeholder="Choose type"
            isSearchable={false}
            options={MAPPING_OPTIONS}
            value={MAPPING_OPTIONS.find(o => o.value === type)}
            onChange={type => onMappingTypeChange(type.value!)}
          />
        </div>
      </FieldConfigItemHeaderTitle>
      <div className={styles.content}>{renderRow()}</div>
    </div>
  );
};
