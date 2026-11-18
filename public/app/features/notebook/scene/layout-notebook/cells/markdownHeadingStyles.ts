import { type ThemeTypography, type ThemeTypographyVariant } from '@grafana/data';

export function headingStyles(variant: ThemeTypographyVariant) {
  return {
    fontSize: variant.fontSize,
    fontWeight: variant.fontWeight,
    lineHeight: variant.lineHeight,
    // Omitted, not undefined: CodeMirror's style-mod disallows undefined values.
    ...(variant.letterSpacing ? { letterSpacing: variant.letterSpacing } : {}),
  };
}

/**
 * Weight for bold text inside a heading. Some themes give headings a weight heavier than the weight
 * `strong` uses (e.g. 600 headings with 500 `strong` in read mode), so bold would look lighter than the
 * rest of the heading. Never go below the heading's own weight. Not a step above it: Inter is only
 * loaded up to 600, so anything heavier renders the same as a 600 heading.
 */
export function headingBoldWeight(variant: ThemeTypographyVariant, typography: ThemeTypography) {
  return Math.max(typography.fontWeightBold, variant.fontWeight);
}
