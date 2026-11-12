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
 * Weight for bold text inside a heading. Some themes give headings a weight equal to or heavier than
 * their bold weight (e.g. 600 headings with 600 bold), so plain bold would look unchanged — or lighter
 * than the rest of the heading. Always keep it a step heavier than the heading itself.
 */
export function headingBoldWeight(variant: ThemeTypographyVariant, typography: ThemeTypography) {
  return Math.max(typography.fontWeightBold, variant.fontWeight + 100);
}
