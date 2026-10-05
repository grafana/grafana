export type SelectionMode = 'replace' | 'toggle' | 'range';

export interface SelectionClickInput {
  /** Category values in display order */
  categories: string[];
  /** Values this panel currently selects, or undefined when it owns no selection for the key */
  current: string[] | undefined;
  /** Category value that anchors Shift ranges, or null */
  anchor: string | null;
  /** Category value of the clicked bar */
  clicked: string;
  /** Ctrl or Cmd was held */
  meta: boolean;
  /** Shift was held */
  shift: boolean;
}

export interface SelectionClickResult {
  /** Next selected values in display order; empty clears the selection */
  values: string[];
  mode: SelectionMode;
  /** Next anchor */
  anchor: string | null;
}

/**
 * Applies a bar click to a selection.
 *
 * - Plain click replaces the selection; clicking the sole selected value clears it.
 * - Ctrl/Cmd-click toggles one value.
 * - Shift-click adds every category from the anchor to the clicked one, inclusive.
 * - Plain and Ctrl/Cmd clicks move the anchor; Shift does not.
 * - When the panel owns no selection (`current` is undefined), a plain click takes ownership and never clears.
 */
export function applySelectionClick({
  categories,
  current,
  anchor,
  clicked,
  meta,
  shift,
}: SelectionClickInput): SelectionClickResult {
  const selected = current ?? [];

  if (shift) {
    const from = anchor == null ? -1 : categories.indexOf(anchor);
    const to = categories.indexOf(clicked);

    if (from === -1 || to === -1) {
      // no usable anchor: start a range at the clicked value
      return { values: inDisplayOrder(categories, union(selected, [clicked])), mode: 'range', anchor: clicked };
    }

    const range = categories.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { values: inDisplayOrder(categories, union(selected, range)), mode: 'range', anchor };
  }

  if (meta) {
    const values = selected.includes(clicked) ? selected.filter((v) => v !== clicked) : [...selected, clicked];
    return { values: inDisplayOrder(categories, values), mode: 'toggle', anchor: clicked };
  }

  const isSoleSelected = current !== undefined && selected.length === 1 && selected[0] === clicked;
  return { values: isSoleSelected ? [] : [clicked], mode: 'replace', anchor: clicked };
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
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
