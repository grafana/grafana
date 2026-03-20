/** Satisfies `Combobox` / `MultiCombobox` `AutoSizeConditionals` (mutually exclusive branches). */
export type ComboboxLayout = { width: 'auto'; minWidth: number; maxWidth?: number } | { width?: number };

export function pickComboboxLayout(
  width: number | 'auto' | undefined,
  minWidth: number | undefined,
  maxWidth: number | undefined
): ComboboxLayout {
  if (width === 'auto') {
    return { width: 'auto', minWidth: minWidth ?? 8, maxWidth };
  }
  return { width };
}
