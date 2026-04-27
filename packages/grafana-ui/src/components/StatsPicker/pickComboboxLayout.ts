/** Satisfies `Combobox` / `MultiCombobox` `AutoSizeConditionals` (mutually exclusive branches). */
export type ComboboxLayout = { width: 'auto'; minWidth: number; maxWidth?: number } | { width?: number };

const DEFAULT_MIN_WIDTH = 8;

export function pickComboboxLayout(
  width: number | 'auto' | undefined,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth: number | undefined
): ComboboxLayout {
  if (width === 'auto') {
    return { width: 'auto', minWidth, maxWidth };
  }
  return { width };
}
