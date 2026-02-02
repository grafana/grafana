import { FC, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Icon, Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { calcFieldsSrv } from '../../../../core/services/calcFields_srv';
import { DEFAULT_SORT } from '../../constants';
import { typeMap } from '../../types';

export interface Props {
  onChange: (sortValue: SelectableValue) => void;
  value?: SelectableValue | null;
  placeholder?: string;
}

const getSortOptions = () => {
  return calcFieldsSrv.getSortOptions().then(({ sortOptions }) => {
    return sortOptions.map((opt: any) => ({ label: opt.displayName, value: opt.name }));
  });
};

export const SortPicker: FC<Props> = ({ onChange, value, placeholder }) => {
  // Using sync Select and manual options fetching here since we need to find the selected option by value

  const { loading, value: options } = useAsync(getSortOptions, []);
  const defaultPlaceholder = t('bmc.calc-fields.sort-placeholder', 'Sort (Default {{label}})', {
    label: DEFAULT_SORT.label,
  });

  return !loading ? (
    <Select
      onChange={onChange}
      value={options?.filter((opt) => opt.value === value)}
      options={options}
      placeholder={placeholder ?? defaultPlaceholder}
      prefix={<Icon name="sort-amount-down" />}
      // BMC Code : Accessibility Change Next line
      aria-label={'Sort Options'}
    />
  ) : null;
};
interface FilterPickerProps {
  onChange: (selectedVal: SelectableValue) => void;
  options: string[];
  value?: string;
}
export const TypePicker: FC<FilterPickerProps> = ({ onChange, options, value }) => {
  const [filterOptions, setFilterOptions] = useState<SelectableValue[]>();
  useEffect(() => {
    const optArr: SelectableValue[] = [{ label: t('bmc.calc-fields.all', 'All'), value: 'All' }];
    options.map((item: string) => optArr.push({ label: typeMap[item], value: item }));
    setFilterOptions(optArr);
  }, [options]);

  const filterByType = t('bmc.calc-fields.filter-by-type', 'Filter by type (Default All)');
  return filterOptions?.length ? (
    <Select
      width={30}
      onChange={onChange}
      value={filterOptions?.filter((opt) => opt.value === value)}
      options={filterOptions}
      placeholder={filterByType}
      prefix={<Icon name="filter" />}
    />
  ) : null;
};
