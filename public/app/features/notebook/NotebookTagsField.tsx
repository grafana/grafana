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
 * Enough tags to fill a dropdown. The server orders terms by count, so a library with more distinct
 * tags than this loses the rarest rather than an arbitrary slice.
 */
const TAG_FACET_LIMIT = 100;

interface Props {
  /** The tags selected, or the ones on the notebook being edited. */
  value: string[];
  onChange: (tags: string[]) => void;
  /** What the empty field says. Each caller's own, because filtering and tagging read differently. */
  placeholder: string;
  /**
   * Lets a tag be typed rather than picked. The callers that set a notebook's tags need it to invent
   * one; the callers that filter need it to reach a tag the dropdown does not list — the facet
   * returns the hundred most-used, so a bigger library keeps its rarest tags out of the options
   * altogether, and typing is the only way back to them.
   *
   * The "Hit enter to add" hint comes from Select's own default; a formatCreateLabel is deliberately
   * not passed, as none of Grafana's other tag inputs pass one.
   */
  allowCustomValue?: boolean;
  /** Associates a caller's `<label>` or `Field` with the input. */
  inputId?: string;
  /**
   * Tags to offer when the facet cannot answer, for a caller that already holds some — the rows a
   * list has loaded. Not a substitute where the facet works: it knows the whole library and the
   * counts, and these are only what one caller happens to be holding.
   */
  fallbackTags?: string[];
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
 * nobody touches costs no request. Where the search route is not served the facet cannot answer and
 * the dropdown is empty; a caller that allows custom values can still be typed into.
 */
export function NotebookTagsField({
  value,
  onChange,
  placeholder,
  allowCustomValue,
  inputId,
  disabled,
  fallbackTags = NO_TAGS,
}: Props) {
  const [fetchFacet] = useLazyNotebookFieldFacetQuery();
  const tags = value.length > 0 ? value : NO_TAGS;

  /**
   * Deliberately not unwrapped: where the search route is not served this 404s, and an empty picker
   * is a better answer than throwing out of the focus handler TagFilter calls this from.
   */
  const tagOptions = useCallback(async (): Promise<TermCount[]> => {
    const { data } = await fetchFacet({ field: TAGS_FIELD, limit: TAG_FACET_LIMIT });
    const terms = data?.facets?.[TAGS_FIELD] ?? [];
    if (terms.length > 0) {
      return terms.map((term) => ({ term: term.value, count: term.count }));
    }
    // Counted as zero rather than counted at all: TagBadge renders no number for zero, and a count
    // over whatever one caller loaded would read as the library's.
    return fallbackTags.map((term) => ({ term, count: 0 }));
  }, [fetchFacet, fallbackTags]);

  return (
    <TagFilter
      inputId={inputId}
      tags={tags}
      tagOptions={tagOptions}
      onChange={(tags) => onChange(normalizeTags(tags))}
      allowCustomValue={allowCustomValue}
      // Tags are dropped by removing their badge, as in dashboard search, rather than through a
      // second control for it.
      isClearable={false}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

/**
 * A custom value arrives as the raw string the user typed, so `latency ` would otherwise become a tag
 * that renders identically to `latency` but is not equal to it.
 *
 * Case is deliberately left alone. Lowercasing would also rewrite tags picked *from the dropdown* — a
 * notebook tagged `Production` would silently become `production` the moment anything else was
 * changed — and tags are case-sensitive everywhere else in Grafana.
 *
 * Order is left alone too: a tag lands where it was picked, which is where the badge appears.
 */
function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
