import React, { FC } from 'react';
import { useAsync } from 'react-use';
import { Select, Icon, IconName } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { SearchSrv } from '../../services/search_srv';

const searchSrv = new SearchSrv();

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: string;
  placeholder?: string;
}

const getSortOptions = () => {
  return searchSrv.getSortOptions().then(({ sortOptions }) => {
    return sortOptions.map((opt: any) => ({ label: opt.displayName, value: opt.name }));
  });
};

export const SortPicker: FC<Props> = ({ onChange, value, placeholder }) => {
  // Using sync Select and manual options fetching here since we need to find the selected option by value
  const { loading, value: options } = useAsync<SelectableValue[]>(getSortOptions, []);

  const selected = options?.filter((opt) => opt.value === value);
  return !loading ? (
    <Select
      key={value}
      width={25}
      onChange={onChange}
      value={selected?.length ? selected : null}
      options={options}
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name={(value?.includes('asc') ? 'sort-amount-up' : 'sort-amount-down') as IconName} />}
    />
  ) : null;
};
