import React, { FC } from 'react';
import { useAsync } from 'react-use';
import { Select, Icon } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { SearchSrv } from '../../services/search_srv';

const searchSrv = new SearchSrv();

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: SelectableValue | null;
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

  return !loading ? (
    <Select
      width={25}
      onChange={onChange}
      value={options?.filter(opt => opt.value === value)}
      options={options}
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name="sort-amount-down" />}
    />
  ) : null;
};
