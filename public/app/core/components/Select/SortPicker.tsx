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

  const isDesc = Boolean(value?.includes('desc') || value?.startsWith('-')); // bluge syntax starts with "-"
  return (
    <Select
      key={value}
      width={28}
      onChange={onChange}
      value={options.value?.find((opt) => opt.value === value) ?? null}
      options={options.value}
      aria-label="Sort"
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name={isDesc ? 'sort-amount-down' : 'sort-amount-up'} />}
      isClearable={isClearable}
    />
  );
}
