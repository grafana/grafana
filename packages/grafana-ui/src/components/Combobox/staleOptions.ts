import { useCombobox, type UseComboboxState, type UseComboboxStateChangeOptions } from 'downshift';
import { useEffect, useRef } from 'react';

import { type ComboboxOption } from './types';

type IsOptionStale<T extends string | number> = (option: ComboboxOption<T> | null | undefined) => boolean;

/**
 * While a newer async search is pending, or after one failed, Combobox shows the earlier search's results so the menu
 * doesn't flicker. This keeps them from being highlighted, whether by keyboard or hover, or picked, whether by Enter,
 * click, Alt+Up or blur. Enter with nothing pickable leaves the menu and the search as they are.
 */
export function blockStaleOptions<T extends string | number>(
  state: UseComboboxState<ComboboxOption<T>>,
  { type, changes }: UseComboboxStateChangeOptions<ComboboxOption<T>>,
  options: Array<ComboboxOption<T>>,
  stale: boolean,
  isOptionStale: IsOptionStale<T>
): Partial<UseComboboxState<ComboboxOption<T>>> {
  if (!stale) {
    return changes;
  }
  let next = changes;
  if (next.highlightedIndex !== undefined && isOptionStale(options[next.highlightedIndex])) {
    next = { ...next, highlightedIndex: -1 };
  }
  if (type === useCombobox.stateChangeTypes.InputKeyDownEnter) {
    const highlighted = options[state.highlightedIndex];
    if (!highlighted || isOptionStale(highlighted)) {
      return state;
    }
  }
  if (next.selectedItem !== state.selectedItem && isOptionStale(next.selectedItem)) {
    next = { ...next, selectedItem: state.selectedItem };
  }
  return next;
}

/**
 * Keeps the highlight on a row Enter can pick while options are stale, moving it to the first pickable one, such as the
 * custom value, or clearing it. When the results for a typed search then arrive, highlights the first one for Enter to
 * pick, as it would be had they come back at once. A menu opened without typing is left to the user, so tabbing past it
 * picks nothing, and synchronous options are never touched.
 */
export function useHighlightFreshOptions<T extends string | number>({
  stale,
  isOpen,
  hasTyped,
  highlightedIndex,
  options,
  isOptionStale,
  setHighlightedIndex,
}: {
  stale: boolean;
  isOpen: boolean;
  hasTyped: () => boolean;
  highlightedIndex: number;
  options: Array<ComboboxOption<T>>;
  isOptionStale: IsOptionStale<T>;
  setHighlightedIndex: (index: number) => void;
}) {
  const wasStale = useRef(stale);
  useEffect(() => {
    const justFreshened = wasStale.current && !stale;
    wasStale.current = stale;
    if (!isOpen || !(stale || (justFreshened && hasTyped()))) {
      return;
    }
    const isPickable = (option: ComboboxOption<T> | undefined) =>
      !!option && !option.infoOption && !isOptionStale(option);
    // A highlight kept while stale points at an index, which fresh results may fill with a different option.
    if (stale && isPickable(options[highlightedIndex])) {
      return;
    }
    const firstPickable = options.findIndex(isPickable);
    // -1 when nothing can be picked, such as fresh results that are all info rows.
    if (firstPickable !== highlightedIndex) {
      setHighlightedIndex(firstPickable);
    }
    // Only when the options or their staleness change, so a highlight the user moved isn't overridden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, options, isOptionStale]);
}
