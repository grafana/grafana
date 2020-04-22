import React, { FC } from 'react';
import { AsyncSelect, Icon } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DEFAULT_SORT } from 'app/features/search/constants';
import { SearchSrv } from '../../services/search_srv';

const searchSrv = new SearchSrv();

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: SelectableValue;
  placeholder?: string;
}

export const SortPicker: FC<Props> = ({ onChange, value, placeholder }) => {
  const getSortOptions = () => {
    return searchSrv.getSortOptions().then(({ sortOptions }) => {
      return sortOptions.map((opt: any) => ({ label: opt.displayName, value: opt.name }));
    });
  };

  return (
    <AsyncSelect
      width={25}
      onChange={onChange}
      value={[value]}
      loadOptions={getSortOptions}
      defaultOptions
      placeholder={placeholder ?? `Sort (Default ${DEFAULT_SORT.label})`}
      prefix={<Icon name="sort-amount-down" />}
    />
  );
};
