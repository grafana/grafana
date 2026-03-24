import { difference } from 'lodash';
import { memo, useEffect } from 'react';

import { fieldReducers, FieldReducerInfo } from '@grafana/data';

import { Combobox, ComboboxProps } from '../Combobox/Combobox';
import { MultiCombobox, MultiComboboxProps } from '../Combobox/MultiCombobox';
import { ComboboxOption } from '../Combobox/types';
import { selectableValueToComboboxOption } from '../Combobox/utils';

import { pickComboboxLayout } from './pickComboboxLayout';

/** Props managed by StatsPicker — forwarded combobox props must not replace these. */
type ComboboxManagedProps = 'value' | 'options' | 'onChange' | 'isClearable' | 'width' | 'minWidth' | 'maxWidth';

/** Forwarded props (managed keys + layout are applied after the spread). */
type MultiSpread = Omit<MultiComboboxProps<string>, ComboboxManagedProps>;
type SingleSpread = Omit<ComboboxProps<string>, ComboboxManagedProps>;

interface BaseProps {
  stats: string[];
  onChange: (stats: string[]) => void;
  defaultStat?: string;
  width?: number | 'auto';
  minWidth?: number;
  maxWidth?: number;
  filterOptions?: (ext: FieldReducerInfo) => boolean;
}

type MultiProps = MultiSpread & { allowMultiple: true };
type SingleProps = SingleSpread & { allowMultiple?: false };

export type StatsPickerProps = BaseProps & (MultiProps | SingleProps);

export const StatsPicker = memo<StatsPickerProps>(
  ({
    placeholder,
    onChange,
    stats,
    allowMultiple = false,
    defaultStat,
    width,
    minWidth,
    maxWidth,
    filterOptions,
    ...rest
  }) => {
    const layout = pickComboboxLayout(width, minWidth, maxWidth);

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

    if (allowMultiple) {
      const multiOnlyRest: MultiSpread = rest;
      const multiProps = {
        ...multiOnlyRest,
        ...layout,
        value,
        isClearable: !defaultStat,
        options,
        placeholder,
        onChange: (items: Array<ComboboxOption<string>>) => onChange(items.map((v) => v.value)),
      } satisfies MultiComboboxProps<string>;

      return <MultiCombobox {...multiProps} />;
    }

    const singleSpread: SingleSpread = rest;

    if (defaultStat) {
      const notClearableProps = {
        ...singleSpread,
        ...layout,
        value: value[0],
        options,
        placeholder,
        isClearable: false as const,
        onChange: (item: ComboboxOption) => onChange(item.value ? [item.value] : []),
      } satisfies ComboboxProps<string>;

      return <Combobox {...notClearableProps} />;
    }

    const clearableProps = {
      ...singleSpread,
      ...layout,
      value: value[0],
      options,
      placeholder,
      isClearable: true as const,
      onChange: (item: ComboboxOption | null) => onChange(item && item.value ? [item.value] : []),
    } satisfies ComboboxProps<string>;

    return <Combobox {...clearableProps} />;
  }
);

StatsPicker.displayName = 'StatsPicker';
