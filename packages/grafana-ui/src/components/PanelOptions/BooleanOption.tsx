import React from 'react';

import { Switch } from '../Switch/Switch';
import { OptionInputAPI } from '../../types/panelOptions';

interface BooleanOptionProps extends OptionInputAPI<boolean> {}

export const BooleanOption: React.FunctionComponent<BooleanOptionProps> = ({ properties, value, onChange }) => {
  return (
    <Switch
      label={properties ? (properties.label || '')  : ''}
      checked={value}
      onChange={event => {
        if (event) {
          onChange((event.target as HTMLInputElement).checked);
        }
      }}
    />
  );
};
