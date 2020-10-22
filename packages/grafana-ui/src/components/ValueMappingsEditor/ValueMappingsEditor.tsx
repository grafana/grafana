import React from 'react';
import { MappingType, ValueMapping } from '@grafana/data';
import { Button } from '../Button/Button';
import { MappingRow } from './MappingRow';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

export const ValueMappingsEditor: React.FC<Props> = ({ value, onChange, children }) => {
  const onAdd = () => {
    const defaultMapping = {
      type: MappingType.ValueToText,
      from: '',
      to: '',
      text: '',
    };

    const id = Math.max(...value.map(v => v.id), 0) + 1;

    onChange([
      ...value,
      {
        id,
        ...defaultMapping,
      },
    ]);
  };

  const onRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const onMappingChange = (update: ValueMapping) => {
    onChange(value.map(item => (item.id === update.id ? update : item)));
  };

  return (
    <>
      {value.map((valueMapping, index) => (
        <MappingRow
          key={`${valueMapping.text}-${index}`}
          valueMapping={valueMapping}
          onUpdate={onMappingChange}
          onRemove={() => onRemove(index)}
        />
      ))}
      <Button
        size="sm"
        icon="plus"
        onClick={onAdd}
        aria-label="ValueMappingsEditor add mapping button"
        variant="secondary"
      >
        Add value mapping
      </Button>
    </>
  );
};
