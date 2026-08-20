import { useMemo } from 'react';

import { type ComboboxOption } from '@grafana/ui';
import { useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { NOTEBOOKS_PAGE_LIMIT } from '../../list/useNotebooksList';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Module scope so an untagged notebook does not hand the memo below a new array on every render. */
const NO_TAGS: string[] = [];

/**
 * Every tag in the library, for the tag picker's dropdown.
 *
 * Not built on useNotebooksList: that hook also resolves author display names through a second
 * endpoint, which this has no use for.
 *
 * @param currentTags the tags on the notebook being edited, unioned in because a tag typed by hand a
 * moment ago is on no saved notebook yet. Without it the dropdown would list that tag as unticked
 * while its own pill sat in the field. Must be referentially stable between renders — scene state
 * is, which is where it comes from — because what this returns becomes MultiCombobox's `options`,
 * and that feeds a memoized fuzzy search.
 */
export function useNotebookTagOptions(currentTags: string[] = NO_TAGS): Array<ComboboxOption<string>> {
  // No skipToken: this hook is only mounted while editing, so there is nothing to skip.
  const { data } = useListNotebookQuery({ limit: NOTEBOOKS_PAGE_LIMIT });

  const libraryTags = useMemo(() => (data?.items ?? []).flatMap((notebook) => notebook.spec.tags ?? []), [data]);

  return useMemo(() => {
    const unique = Array.from(new Set([...libraryTags, ...currentTags]));
    unique.sort(collator.compare);
    return unique.map((tag) => ({ label: tag, value: tag }));
  }, [libraryTags, currentTags]);
}
