/**
 * An `id` for an expandable block, safe to put in an `aria-controls` token list.
 *
 * The name has to be escaped: `aria-controls` is space-separated, and a Prometheus 3.x UTF-8 metric
 * name or label key may contain a space, which would parse as several ids pointing nowhere.
 *
 * `prefix` comes from a `useId()` per list rather than from the name alone, because a Mixed pane
 * renders one list per card and two cards can offer the same metric name — name-derived ids alone
 * would put duplicates in the document and each toggle would resolve to whichever came first.
 */
export const blockId = (prefix: string, kind: string, name: string) => `${prefix}-${kind}-${encodeURIComponent(name)}`;
