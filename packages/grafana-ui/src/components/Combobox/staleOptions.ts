import { useCombobox, type UseComboboxState, type UseComboboxStateChangeOptions } from 'downshift';
import { useEffect } from 'react';

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
 * Moves the highlight off a row that has just become stale. When the results for a typed search arrive, highlights the
 * first pickable one for Enter to pick, as it would be had they come back at once. A menu opened without typing is left
 * to the user, so tabbing past it picks nothing.
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
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (stale) {
      if (isOptionStale(options[highlightedIndex])) {
        setHighlightedIndex(-1);
      }
      return;
    }
    if (hasTyped() && highlightedIndex < 0) {
      const firstPickable = options.findIndex((option) => !option.infoOption);
      if (firstPickable >= 0) {
        setHighlightedIndex(firstPickable);
      }
    }
    // Only when the options turn stale or fresh, so a highlight the user moved isn't overridden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);
}
