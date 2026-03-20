import { difference } from 'lodash';
import { memo, useEffect } from 'react';

import { fieldReducers, FieldReducerInfo } from '@grafana/data';

import { Combobox, ComboboxProps } from '../Combobox/Combobox';
import { MultiCombobox, MultiComboboxProps } from '../Combobox/MultiCombobox';
import { ComboboxOption } from '../Combobox/types';
import { selectableValueToComboboxOption } from '../Combobox/utils';

interface BaseProps {
  onChange: (stats: string[]) => void;
  stats: string[];
  defaultStat?: string;
  /** @deprecated use id instead */
  inputId?: string;
  filterOptions?: (ext: FieldReducerInfo) => boolean;
}
type ComboboxManagedProps = 'value' | 'options' | 'onChange' | 'isClearable';
type MultiProps = Omit<MultiComboboxProps<string>, ComboboxManagedProps> & { allowMultiple: true };
type SingleProps = Omit<ComboboxProps<string>, ComboboxManagedProps> & { allowMultiple?: false };
type StatsPickerProps = BaseProps & (MultiProps | SingleProps);

export const StatsPicker = memo<StatsPickerProps>(
  ({
    placeholder,
    onChange,
    stats,
    allowMultiple = false,
    defaultStat,
    width,
    inputId,
    id: idProp,
    filterOptions,
    ...rest
  }) => {
    const id = idProp ?? inputId;

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
        id={id}
        value={value}
        isClearable={!defaultStat}
        width={width}
        options={options}
        placeholder={placeholder}
        onChange={(items) => onChange(items.map((v) => v.value))}
        {...rest}
      />
    ) : (
      <Combobox<string>
        id={id}
        value={value[0]}
        isClearable={!defaultStat}
        width={width}
        options={options}
        placeholder={placeholder}
        onChange={(item: ComboboxOption<string> | null) => onChange(item && item.value ? [item.value] : [])}
        {...rest}
      />
    );
  }
);

StatsPicker.displayName = 'StatsPicker';
