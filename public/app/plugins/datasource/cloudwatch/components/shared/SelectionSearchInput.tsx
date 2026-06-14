import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { Icon, Input } from '@grafana/ui';

type Props = {
  ariaLabel: string;
  placeholder: string;
  searchPhrase: string;
  searchFn: (searchPhrase: string) => void;
};

export const SelectionSearchInput = ({ ariaLabel, placeholder, searchFn, searchPhrase }: Props) => {
  const [searchFilter, setSearchFilter] = useState(searchPhrase);

  const debouncedSearch = useMemo(() => debounce(searchFn, 600), [searchFn]);

  useEffect(() => {
    return () => {
      debouncedSearch?.cancel();
    };
  }, [debouncedSearch]);

  return (
    <Input
      aria-label={ariaLabel}
      prefix={<Icon name="search" />}
      value={searchFilter}
      onChange={(event) => {
        const nextSearchPhrase = event.currentTarget.value;
        setSearchFilter(nextSearchPhrase);
        debouncedSearch(nextSearchPhrase);
      }}
      placeholder={placeholder}
    />
  );
};
