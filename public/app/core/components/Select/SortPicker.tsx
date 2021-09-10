import React, { FC } from 'react';
import { useAsync } from 'react-use';
import { Icon, IconName, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { SearchSrv } from '../../services/search_srv';

const searchSrv = new SearchSrv();

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: string;
  placeholder?: string;
  filter?: string[];
}

const getSortOptions = (filter?: string[]) => {
  return searchSrv.getSortOptions().then(({ sortOptions }) => {
    const filteredOptions = filter ? sortOptions.filter((o: any) => filter.includes(o.name)) : sortOptions;
    return filteredOptions.map((opt: any) => ({ label: opt.displayName, value: opt.name }));
  });
};

export const SortPicker: FC<Props> = ({ onChange, value, placeholder, filter }) => {
  // Using sync Select and manual options fetching here since we need to find the selected option by value
  const { loading, value: options } = useAsync<() => Promise<SelectableValue[]>>(() => getSortOptions(filter), []);

  const selected = options?.find((opt) => opt.value === value);
  return !loading ? (
    <Select
      menuShouldPortal
      key={value}
      width={25}
      onChange={onChange}
      value={selected ?? null}
      options={options}
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name={(value?.includes('asc') ? 'sort-amount-up' : 'sort-amount-down') as IconName} />}
    />
  ) : null;
};
