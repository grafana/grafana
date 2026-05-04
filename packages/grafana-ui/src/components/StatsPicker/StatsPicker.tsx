import { memo, useEffect } from 'react';

import { fieldReducers, type FieldReducerInfo } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Combobox, type ComboboxProps } from '../Combobox/Combobox';
import { MultiCombobox, type MultiComboboxProps } from '../Combobox/MultiCombobox';
import { type ComboboxOption } from '../Combobox/types';
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
    placeholder = t('grafana-ui.stats-picker.placeholder', 'Choose'),
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
        const foundSet = new Set(found);
        const notFound = stats.filter((stat) => !foundSet.has(stat));
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
      return (
        <MultiCombobox
          {...rest}
          {...layout}
          value={value}
          options={options}
          placeholder={placeholder}
          isClearable={!defaultStat}
          onChange={(items: Array<ComboboxOption<string>>) => onChange(items.map((v) => v.value))}
        />
      );
    }

    const commonOptions = {
      ...rest,
      ...layout,
      value: value[0],
      options,
      placeholder,
    };

    return defaultStat ? (
      <Combobox
        {...commonOptions}
        isClearable={false}
        onChange={(item: ComboboxOption | null) => onChange(item && item.value ? [item.value] : [])}
      />
    ) : (
      <Combobox
        {...commonOptions}
        isClearable={true}
        onChange={(item: ComboboxOption | null) => onChange(item && item.value ? [item.value] : [])}
      />
    );
  }
);

StatsPicker.displayName = 'StatsPicker';
