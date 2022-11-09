import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { Icon, Input, useStyles2 } from '@grafana/ui';

import getStyles from './components/styles';

// TODO: consider moving search into grafana/ui, this is mostly the same as that in azure monitor
const Search = ({ searchFn, searchPhrase }: { searchPhrase: string; searchFn: (searchPhrase: string) => void }) => {
  const [searchFilter, setSearchFilter] = useState(searchPhrase);
  const styles = useStyles2(getStyles);

  const debouncedSearch = useMemo(() => debounce(searchFn, 600), [searchFn]);

  useEffect(() => {
    return () => {
      // Stop the invocation of the debounced function after unmounting
      debouncedSearch?.cancel();
    };
  }, [debouncedSearch]);

  return (
    <Input
      className={styles.search}
      width={64}
      aria-label="log group search"
      prefix={<Icon name="search" />}
      value={searchFilter}
      onChange={(event) => {
        const searchPhrase = event.currentTarget.value;
        setSearchFilter(searchPhrase);
        debouncedSearch(searchPhrase);
      }}
      placeholder="search by log group name prefix"
    />
  );
};

export default Search;
