import React from 'react';
import { ValuePicker } from '@grafana/ui';

type AddLayerButtonProps = { onChange: any; options: any; label: string };

export const AddLayerButton = ({ onChange, options, label }: AddLayerButtonProps) => {
  return (
    <ValuePicker
      icon="plus"
      label={label}
      variant="secondary"
      options={options}
      onChange={onChange}
      isFullWidth={true}
    />
  );
};
