import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useCallback, useMemo, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { type TermCount } from 'app/core/components/TagFilter/TagFilter';

import { type OrgDashboardTemplate } from '../../../../extensions/api/clients/orgtemplate/v1alpha1/endpoints.gen';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

interface UseTemplateFilteringOptions<T> {
  items: T[];
  getTitle: (item: T) => string;
  getDescription: (item: T) => string;
  getTags?: (item: T) => string[];
  getCreatorUid?: (item: T) => string;
}

export function useTemplateFiltering<T>({
  items,
  getTitle,
  getDescription,
  getTags,
  getCreatorUid,
}: UseTemplateFilteringOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [sortValue, setSortValue] = useState<string | undefined>(undefined);

  // Extract unique creator UIDs for display name resolution
  const creatorUids = useMemo(() => {
    if (!getCreatorUid) {
      return undefined;
    }
    return uniq(compact(items.map(getCreatorUid)));
  }, [items, getCreatorUid]);

  // Resolve UIDs to display names via IAM API (same pattern as Saved Queries)
  const { data: displayMapping } = useGetDisplayMappingQuery(
    creatorUids && creatorUids.length > 0 ? { key: creatorUids } : skipToken
  );

  // Build a UID → displayName map
  const creatorDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    if (displayMapping?.display) {
      for (const entry of displayMapping.display) {
        const uid = `${entry.identity.type}:${entry.identity.name}`;
        map.set(uid, entry.displayName);
      }
    }
    return map;
  }, [displayMapping]);

  // Tag options as TermCount[] for TagFilter component
  const tagTermCounts = useMemo<TermCount[]>(() => {
    if (!getTags) {
      return [];
    }
    const tagCounts = new Map<string, number>();
    for (const item of items) {
      for (const tag of getTags(item)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries())
      .sort(([a], [b]) => collator.compare(a, b))
      .map(([term, count]) => ({ term, count }));
  }, [items, getTags]);

  // Async callback for TagFilter's tagOptions prop
  const getTagOptions = useCallback((): Promise<TermCount[]> => {
    return Promise.resolve(tagTermCounts);
  }, [tagTermCounts]);

  // Unique creator options with display names
  const creatorOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    if (!creatorUids) {
      return [];
    }
    return creatorUids.map((uid) => ({
      value: uid,
      label: creatorDisplayMap.get(uid) || uid,
    }));
  }, [creatorUids, creatorDisplayMap]);

  // Sort options for SortPicker
  const getSortOptions = () => {
    return Promise.resolve([alphabeticallySortingOption(), alphabeticallyReverseSortingOption()]);
  };

  const alphabeticallySortingOption = () => ({
    value: 'asc',
    label: t('query-library.filters.sort.asc', 'Alphabetically (A–Z)'),
    sort: (a: OrgDashboardTemplate, b: OrgDashboardTemplate) => {
      const aTitle = a.spec.title ?? '';
      const bTitle = b.spec.title ?? '';
      return collator.compare(aTitle, bTitle);
    },
  });

  const alphabeticallyReverseSortingOption = () => ({
    value: 'desc',
    label: t('query-library.filters.sort.desc', 'Alphabetically (Z–A)'),
    sort: (a: OrgDashboardTemplate, b: OrgDashboardTemplate) => {
      const aTitle = a.spec.title ?? '';
      const bTitle = b.spec.title ?? '';
      return collator.compare(bTitle, aTitle);
    },
  });

  // Filter and sort
  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter (title + description)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const title = getTitle(item).toLowerCase();
        const description = getDescription(item).toLowerCase();
        return title.includes(query) || description.includes(query);
      });
    }

    // Tag filter (OR: template must have at least one selected tag)
    if (selectedTags.length > 0 && getTags) {
      result = result.filter((item) => {
        const itemTags = getTags(item);
        return selectedTags.some((tag) => itemTags.includes(tag));
      });
    }

    // Creator filter (OR: template creator must be one of selected)
    if (selectedCreators.length > 0 && getCreatorUid) {
      result = result.filter((item) => {
        const uid = getCreatorUid(item);
        return selectedCreators.includes(uid);
      });
    }

    // Sort
    if (sortValue) {
      result = [...result].sort((a, b) => {
        const titleA = getTitle(a);
        const titleB = getTitle(b);
        return sortValue === 'asc' ? collator.compare(titleA, titleB) : collator.compare(titleB, titleA);
      });
    }

    return result;
  }, [items, searchQuery, selectedTags, selectedCreators, sortValue, getTitle, getDescription, getTags, getCreatorUid]);

  const onTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const onCreatorsChange = (creators: Array<ComboboxOption<string>>) => {
    setSelectedCreators(creators.map((c) => c.value));
  };

  const onSortChange = (change: SelectableValue) => {
    setSortValue(change?.value);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedTags,
    onTagsChange,
    selectedCreators,
    onCreatorsChange,
    sortValue,
    onSortChange,
    filteredItems,
    getTagOptions,
    creatorOptions,
    getSortOptions,
  };
}
