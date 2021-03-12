import React from 'react';
import { Input } from '../Input/Input';
import { ValueMap, ValueMapping } from '@grafana/data';

interface ValueMapProps {
  mapping: ValueMap;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
}

export const ValueMapRow: React.FC<ValueMapProps> = ({ mapping, index, onChange }) => {
  const onBlur = (event: React.FormEvent<HTMLInputElement>) => {
    const txt = event.currentTarget.value;
    onChange(index, { ...mapping, value: txt });
  };

  return <Input width={15} defaultValue={mapping.value || ''} placeholder="Value" prefix="Map" onBlur={onBlur} />;
};
