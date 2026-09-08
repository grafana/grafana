import { useMemo } from 'react';

import { type ComboboxOption } from '@grafana/ui';

import { useNotebookFieldFacetQuery } from '../../list/notebookSearchApi';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Module scope so an untagged notebook does not hand the memo below a new array on every render. */
const NO_TAGS: string[] = [];

/**
 * Enough tags to fill a dropdown. The server orders terms by count, so a library with more distinct
 * tags than this loses the rarest rather than an arbitrary slice.
 */
const TAG_FACET_LIMIT = 100;

/**
 * The field name the search index uses. Spelled out because the list page keeps its own SearchField
 * map private, and reaching into that module for one string is not worth coupling this to it.
 */
const TAGS_FIELD = 'tags';

/**
 * Every tag in the library, for the tag picker's dropdown.
 *
 * Deliberately not useNotebooksList: that hook follows the cursor to the end so its table can order
 * the whole match set, which for a header that only wants tag strings would be several sequential
 * requests for rows nothing reads. It also provides the `Notebook` tag, which every notebook write
 * invalidates - so sharing it would re-ask for these options on every autosave.
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
  const { data } = useNotebookFieldFacetQuery({ field: TAGS_FIELD, limit: TAG_FACET_LIMIT });

  const facetTerms = data?.facets?.[TAGS_FIELD];

  const libraryTags = useMemo(() => (facetTerms ?? []).map((term) => term.value), [facetTerms]);

  return useMemo(() => {
    const unique = Array.from(new Set([...libraryTags, ...currentTags]));
    unique.sort(collator.compare);
    return unique.map((tag) => ({ label: tag, value: tag }));
  }, [libraryTags, currentTags]);
}
