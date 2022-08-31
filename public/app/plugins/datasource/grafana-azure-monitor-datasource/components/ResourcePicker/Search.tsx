import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { Icon, Input } from '@grafana/ui';

const Search = ({ searchFn }: { searchFn: (searchPhrase: string) => void }) => {
  const [searchFilter, setSearchFilter] = useState('');

  const debouncedSearch = useMemo(() => debounce(searchFn, 600), [searchFn]);
  useEffect(() => {
    return () => {
      // Stop the invocation of the debounced function after unmounting
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <Input
      aria-label="resource search"
      prefix={<Icon name="search" />}
      value={searchFilter}
      onChange={(event) => {
        const searchPhrase = event.currentTarget.value;
        setSearchFilter(searchPhrase);
        debouncedSearch(searchPhrase);
      }}
      placeholder="search for a resource"
    />
  );
};

export default Search;
