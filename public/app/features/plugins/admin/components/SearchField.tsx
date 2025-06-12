import { useState, useRef } from 'react';
import * as React from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { FilterInput } from '@grafana/ui';

interface Props {
  value?: string;
  onSearch: (value: string) => void;
}

// useDebounce has a bug which causes it to fire on first render. This wrapper prevents that.
// https://github.com/streamich/react-use/issues/759
const useDebounceWithoutFirstRender = (callBack: () => void, delay = 0, deps: React.DependencyList = []) => {
  const isFirstRender = useRef(true);
  const debounceDeps = [...deps, isFirstRender];

  return useDebounce(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      return callBack();
    },
    delay,
    debounceDeps
  );
};

export const SearchField = ({ value, onSearch }: Props) => {
  const [query, setQuery] = useState(value);

  useDebounceWithoutFirstRender(() => onSearch(query ?? ''), 500, [query]);

  return (
    <FilterInput
      value={query}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          onSearch(e.currentTarget.value);
        }
      }}
      placeholder={t('plugins.search-field.placeholder-search-grafana-plugins', 'Search Grafana plugins')}
      onChange={(value) => {
        setQuery(value);
      }}
      width={46}
    />
  );
};
