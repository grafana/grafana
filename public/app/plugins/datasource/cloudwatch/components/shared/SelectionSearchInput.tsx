import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon, Input } from '@grafana/ui';

type Props = {
  ariaLabel: string;
  placeholder: string;
  searchPhrase: string;
  searchFn: (searchPhrase: string) => void;
};

export const SelectionSearchInput = ({ ariaLabel, placeholder, searchFn, searchPhrase }: Props) => {
  const [searchFilter, setSearchFilter] = useState(searchPhrase);
  const searchFnRef = useRef(searchFn);

  useEffect(() => {
    searchFnRef.current = searchFn;
  }, [searchFn]);

  const debouncedSearch = useMemo(
    () => debounce((nextSearchPhrase: string) => searchFnRef.current(nextSearchPhrase), 600),
    []
  );

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
