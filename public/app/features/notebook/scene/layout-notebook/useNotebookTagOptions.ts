import { useMemo } from 'react';

import { type ComboboxOption } from '@grafana/ui';

import { useSearchNotebooksInfiniteQuery } from '../../list/notebookSearchApi';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Module scope so an untagged notebook does not hand the memo below a new array on every render. */
const NO_TAGS: string[] = [];

/**
 * Enough tags to fill a dropdown. The server orders terms by count, so a library with more distinct
 * tags than this loses the rarest rather than an arbitrary slice.
 */
const TAG_FACET_LIMIT = 100;

/**
 * A facet, not a list: the server aggregates the distinct tag values across everything the query
 * matched and returns just those terms, so no notebook has to be fetched to learn its tags.
 *
 * `limit: 1` because the rows are not wanted at all. A facet is computed over the match set rather
 * than over the page, so asking for one row costs one request and still describes the whole library.
 *
 * Module scope keeps it referentially stable, which is what stops RTK Query treating each render as a
 * new argument and refetching.
 */
const TAG_FACET_QUERY = {
  // The field name the search index uses. Spelled out because the list page keeps its own SearchField
  // map private, and reaching into that module for one string is not worth coupling this to it.
  facets: ['tags'],
  facetLimit: TAG_FACET_LIMIT,
  limit: 1,
};

/**
 * Every tag in the library, for the tag picker's dropdown.
 *
 * Deliberately not useNotebooksList: that hook follows the cursor to the end so its table can order
 * the whole match set, which for a header that only wants tag strings would be several sequential
 * requests for rows nothing reads.
 *
 * With no facet - the search route is not served everywhere, and this asks for no fallback - the
 * dropdown offers only the notebook's own tags. That degrades rather than breaks: the picker takes
 * custom values, so any tag can still be typed.
 *
 * @param currentTags the tags on the notebook being edited, unioned in because a tag typed by hand a
 * moment ago is on no saved notebook yet. Without it the dropdown would list that tag as unticked
 * while its own pill sat in the field. Must be referentially stable between renders - scene state
 * is, which is where it comes from - because what this returns becomes MultiCombobox's `options`,
 * and that feeds a memoized fuzzy search.
 */
export function useNotebookTagOptions(currentTags: string[] = NO_TAGS): Array<ComboboxOption<string>> {
  // Only mounted while editing, so there is nothing to skip.
  const { data } = useSearchNotebooksInfiniteQuery(TAG_FACET_QUERY);

  // Every page carries the same aggregation, so the first one answers for all of them - and only one
  // is ever taken, since nothing here calls fetchNextPage.
  const facetTerms = data?.pages[0]?.facets?.tags;

  const libraryTags = useMemo(() => (facetTerms ?? []).map((term) => term.value), [facetTerms]);

  return useMemo(() => {
    const unique = Array.from(new Set([...libraryTags, ...currentTags]));
    unique.sort(collator.compare);
    return unique.map((tag) => ({ label: tag, value: tag }));
  }, [libraryTags, currentTags]);
}
