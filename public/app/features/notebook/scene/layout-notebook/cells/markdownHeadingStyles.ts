import { type ThemeTypographyVariant } from '@grafana/data';

export function headingStyles(variant: ThemeTypographyVariant) {
  return {
    fontSize: variant.fontSize,
    fontWeight: variant.fontWeight,
    lineHeight: variant.lineHeight,
    // Omitted, not undefined: CodeMirror's style-mod disallows undefined values.
    ...(variant.letterSpacing ? { letterSpacing: variant.letterSpacing } : {}),
  };
}
