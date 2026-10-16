import { useCallback } from 'react';

import { TagFilter, type TermCount } from 'app/core/components/TagFilter/TagFilter';

import { useLazyNotebookFieldFacetQuery } from './list/notebookSearchApi';

/** The field name the search index uses for tags. */
const TAGS_FIELD = 'tags';

/**
 * One shared empty array, because TagFilter reloads its options whenever the identity of the tags it
 * was handed changes — not only when their contents do. A caller defaulting an absent value inline
 * (`tags ?? []`) would otherwise hand it a new array every render and have it re-ask each time.
 */
const NO_TAGS: string[] = [];

/**
 * Everything the search API will give: it clamps to `MaxFacetLimit`, and dashboard search asks for
 * the same number for the same reason.
 *
 * It is a ceiling rather than a choice, and one this picker cannot see past. Terms come back ordered
 * by count, so a library with more distinct tags than this loses its rarest — and typing does not
 * reach them either, because the dropdown filters the options it already holds rather than asking
 * the server again.
 */
const TAG_FACET_LIMIT = 1000;

interface Props {
  /** The tags selected, or the ones on the notebook being edited. */
  value: string[];
  onChange: (tags: string[]) => void;
  /** What the empty field says. Each caller's own, because filtering and tagging read differently. */
  placeholder: string;
  /**
   * Lets a tag be typed rather than picked, for the callers that set a notebook's tags — a tag has
   * to be invented somewhere. The callers that filter leave it off, as dashboard search, playlists
   * and the template library do: a tag nothing carries matches nothing, so offering to create one
   * in a filter only promises a result it cannot return.
   *
   * The "Hit enter to add" hint comes from Select's own default; a formatCreateLabel is deliberately
   * not passed, as none of Grafana's other tag inputs pass one.
   */
  allowCustomValue?: boolean;
  /** Associates a caller's `<label>` or `Field` with the input. */
  inputId?: string;
  disabled?: boolean;
}

/**
 * Every tag control in the feature: the two lists that filter by tag, and the two forms that set a
 * notebook's tags. One component so a tag looks and behaves the same in all four — the same control
 * dashboard search uses, with its colour-per-name badges, its counts, and an input that clears as
 * each tag is picked.
 *
 * Options come from the search index's `tags` facet, aggregated over every notebook rather than over
 * whatever rows a caller is showing, and asked for only when the control is focused — so a form
 * nobody touches costs no request.
 */
export function NotebookTagsField({ value, onChange, placeholder, allowCustomValue, inputId, disabled }: Props) {
  const [fetchFacet] = useLazyNotebookFieldFacetQuery();
  const tags = value.length > 0 ? value : NO_TAGS;

  /**
   * The dropdown's options. TagFilter calls this from its focus handler, so it must not throw: the
   * result is destructured rather than `.unwrap()`ed, which would rethrow a failed request out of
   * that handler. Reading `data` leaves it undefined instead and the picker comes up empty.
   *
   * `preferCacheValue` — the second argument — reuses what the facet already answered for this
   * mount. Without it every focus is another request for a list that barely moves.
   */
  const tagOptions = useCallback(async (): Promise<TermCount[]> => {
    const { data } = await fetchFacet({ field: TAGS_FIELD, limit: TAG_FACET_LIMIT }, true);
    const terms = data?.facets?.[TAGS_FIELD] ?? [];
    return terms.map((term) => ({ term: term.value, count: term.count }));
  }, [fetchFacet]);

  return (
    <TagFilter
      inputId={inputId}
      tags={tags}
      tagOptions={tagOptions}
      onChange={onChange}
      allowCustomValue={allowCustomValue}
      // Tags are dropped by removing their badge, as in dashboard search, rather than through a
      // second control for it.
      isClearable={false}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
