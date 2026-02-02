import { useRef } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Icon, Select } from '@grafana/ui';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: string;
  placeholder?: string;
  getSortOptions?: () => Promise<SelectableValue[]>;
  filter?: string[];
  isClearable?: boolean;
}

const defaultSortOptionsGetter = (): Promise<SelectableValue[]> => {
  return getGrafanaSearcher().getSortOptions();
};

export function SortPicker({ onChange, value, placeholder, filter, getSortOptions, isClearable }: Props) {
  //BMC Code : Accessibility Change : Next line
  const selectRef = useRef<any>(null);
  // Using sync Select and manual options fetching here since we need to find the selected option by value
  const options = useAsync<() => Promise<SelectableValue[]>>(async () => {
    const vals = await (getSortOptions ?? defaultSortOptionsGetter)();
    if (filter) {
      return vals.filter((v) => filter.includes(v.value));
    }
    return vals;
  }, [getSortOptions, filter]);

  if (options.loading) {
    return null;
  }
  //BMC Code : Accessibility Change Starts Here
  const handleChange = (sortValue: SelectableValue) => {
    onChange(sortValue);
    // Retain focus on the select after selection
    requestAnimationFrame(() => {
      if (selectRef.current?.focus) {
        selectRef.current.focus();
      }
    });
  };
  //BMC Code : Accessibility Change End

  const isDesc = Boolean(value?.includes('desc') || value?.startsWith('-')); // bluge syntax starts with "-"
  return (
    <Select
      //BMC Code : Accessibility Change : Next line
      ref={selectRef}
      key={value}
      width={28}
      //BMC Code : Accessibility Change : Next line
      onChange={handleChange}
      value={options.value?.find((opt) => opt.value === value) ?? null}
      options={options.value}
      aria-label="Sort"
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name={isDesc ? 'sort-amount-down' : 'sort-amount-up'} />}
      isClearable={isClearable}
    />
  );
}
