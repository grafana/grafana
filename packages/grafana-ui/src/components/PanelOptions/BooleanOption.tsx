import React from 'react';

import { Switch } from '../Switch/Switch';
import { OptionInputAPI } from '../../types/panelOptions';

export interface BooleanOptionProps extends OptionInputAPI<boolean> {
  label?: string;
}

export const BooleanOption: React.FunctionComponent<BooleanOptionProps> = ({ label, value, onChange }) => {
  return (
    <Switch
      label={label || ''}
      checked={!!value}
      onChange={event => {
        if (event) {
          onChange((event.target as HTMLInputElement).checked);
        }
      }}
    />
  );
};
