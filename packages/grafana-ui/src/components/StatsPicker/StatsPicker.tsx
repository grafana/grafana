import { difference } from 'lodash';
import { memo, useEffect } from 'react';

import { fieldReducers, FieldReducerInfo } from '@grafana/data';

import { Combobox } from '../Combobox/Combobox';
import { MultiCombobox } from '../Combobox/MultiCombobox';
import { ComboboxOption } from '../Combobox/types';
import { selectableValueToComboboxOption } from '../Combobox/utils';

export interface Props {
  placeholder?: string;
  onChange: (stats: string[]) => void;
  stats: string[];
  allowMultiple?: boolean;
  defaultStat?: string;
  className?: string;
  width?: number;
  inputId?: string;
  filterOptions?: (ext: FieldReducerInfo) => boolean;
}

export const StatsPicker = memo<Props>(
  ({ placeholder, onChange, stats, allowMultiple = false, defaultStat, width, inputId, filterOptions }) => {
    useEffect(() => {
      const current = fieldReducers.list(stats);
      if (current.length !== stats.length) {
        const found = current.map((v) => v.id);
        const notFound = difference(stats, found);
        console.warn('Unknown stats', notFound, stats);
        onChange(current.map((stat) => stat.id));
      }

      // Make sure there is only one
      if (!allowMultiple && stats.length > 1) {
        console.warn('Removing extra stat', stats);
        onChange([stats[0]]);
      }

      // Set the reducer from callback
      if (defaultStat && stats.length < 1) {
        onChange([defaultStat]);
      }
    }, [stats, allowMultiple, defaultStat, onChange]);

    const select = fieldReducers.selectOptions(stats, filterOptions);
    const options = select.options.map((v) => selectableValueToComboboxOption(v)).filter((v) => !!v);
    const value = select.current.map((v) => selectableValueToComboboxOption(v)).filter((v) => !!v);
    return allowMultiple ? (
      <MultiCombobox<string>
        id={inputId}
        value={value}
        isClearable={!defaultStat}
        width={width}
        options={options}
        placeholder={placeholder}
        onChange={(items) => onChange(items.map((v) => v.value))}
      />
    ) : (
      <Combobox<string>
        id={inputId}
        value={value[0]}
        isClearable={!defaultStat}
        width={width}
        options={options}
        placeholder={placeholder}
        onChange={(item: ComboboxOption<string> | null) => onChange(item && item.value ? [item.value] : [])}
      />
    );
  }
);

StatsPicker.displayName = 'StatsPicker';
