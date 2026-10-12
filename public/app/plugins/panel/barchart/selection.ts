export type SelectionMode = 'replace' | 'toggle';

export interface SelectionClickInput {
  /** Category values in display order */
  categories: string[];
  /** Values this panel currently selects, or undefined when it owns no selection for the key */
  current: string[] | undefined;
  /** Category value of the clicked bar */
  clicked: string;
  /** Toggle the clicked value (Alt-click) instead of selecting only it (the tooltip's filter action) */
  toggle: boolean;
}

export interface SelectionClickResult {
  /** Next selected values in display order; empty clears the selection */
  values: string[];
  mode: SelectionMode;
}

/**
 * Applies a bar click to a selection.
 *
 * - Toggle (Alt-click) adds or removes one value; when the panel owns no selection it starts a new one.
 * - Replace (the tooltip's filter action) selects only the clicked value.
 */
export function applySelectionClick({
  categories,
  current,
  clicked,
  toggle,
}: SelectionClickInput): SelectionClickResult {
  if (!toggle) {
    return { values: [clicked], mode: 'replace' };
  }

  const selected = current ?? [];
  const values = selected.includes(clicked) ? selected.filter((v) => v !== clicked) : [...selected, clicked];
  return { values: inDisplayOrder(categories, values), mode: 'toggle' };
}

/** Sorts values by category order; values missing from the categories keep their order at the end */
function inDisplayOrder(categories: string[], values: string[]): string[] {
  const set = new Set(values);
  const ordered = Array.from(new Set(categories.filter((c) => set.has(c))));
  const missing = values.filter((v) => !categories.includes(v));
  return [...ordered, ...missing];
}

/** Returns the data indices whose category is selected, or null when nothing is selected */
export function getSelectedIndices(categories: string[], values: string[] | undefined): Set<number> | null {
  if (values == null || values.length === 0) {
    return null;
  }

  const set = new Set(values);
  const indices = new Set<number>();

  categories.forEach((c, i) => {
    if (set.has(c)) {
      indices.add(i);
    }
  });

  return indices;
}
