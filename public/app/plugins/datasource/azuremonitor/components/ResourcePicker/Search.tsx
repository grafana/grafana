import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { Icon, Input } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';

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
      aria-label={t('components.search.aria-label-resource-search', 'Resource search')}
      prefix={<Icon name="search" />}
      value={searchFilter}
      onChange={(event) => {
        const searchPhrase = event.currentTarget.value;
        setSearchFilter(searchPhrase);
        debouncedSearch(searchPhrase);
      }}
      placeholder={t('components.search.placeholder-resource-search', 'Search for a resource')}
      data-testid={selectors.components.queryEditor.resourcePicker.search.input}
    />
  );
};

export default Search;
