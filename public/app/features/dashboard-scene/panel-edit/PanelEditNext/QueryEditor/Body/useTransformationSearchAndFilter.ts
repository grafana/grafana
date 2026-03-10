import { KeyboardEvent, useCallback, useMemo, useState } from 'react';

import { standardTransformersRegistry, TransformerRegistryItem } from '@grafana/data';

import { getTransformerCategories, type TransformerCategoryOption } from '../utils';

export interface UseTransformationSearchResult {
  search: string;
  setSearch: (value: string) => void;
  selectedFilter: TransformerCategoryOption['slug'] | null;
  setSelectedFilter: (value: TransformerCategoryOption['slug'] | null) => void;
  categories: TransformerCategoryOption[];
  filteredTransformations: TransformerRegistryItem[];
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  allTransformationsCount: number;
}

export function useTransformationSearchAndFilter(
  onSelectTransformation: (id: string) => void
): UseTransformationSearchResult {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TransformerCategoryOption['slug'] | null>(null);

  const categories = useMemo(() => getTransformerCategories(), []);

  const allTransformations = useMemo(() => {
    const collator = new Intl.Collator();
    return standardTransformersRegistry.list().sort((a, b) => collator.compare(a.name, b.name));
  }, []);

  const filteredTransformations = useMemo(() => {
    let result = allTransformations;

    if (selectedFilter !== null) {
      result = result.filter(({ categories }) => categories?.has(selectedFilter));
    }

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        ({ name, description }) => name.toLowerCase().includes(lower) || description?.toLowerCase().includes(lower)
      );
    }

    return result;
  }, [allTransformations, selectedFilter, search]);

  const onSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && search && filteredTransformations.length > 0) {
        onSelectTransformation(filteredTransformations[0].id);
      } else if (event.key === 'Escape') {
        setSearch('');
        event.stopPropagation();
      }
    },
    [search, filteredTransformations, onSelectTransformation]
  );

  return {
    search,
    setSearch,
    selectedFilter,
    setSelectedFilter,
    categories,
    filteredTransformations,
    onSearchKeyDown,
    allTransformationsCount: allTransformations.length,
  };
}
