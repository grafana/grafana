/**
 * CSS custom properties a dashboard style sets on its canvas. Panels and dashboard elements read
 * them with a fallback to the Grafana theme, so the same component works with and without a style.
 *
 * The scoped theme already carries colours, surfaces, series palette and the body font; these
 * variables add what the Grafana theme has no slot for: display and figure typography, the accent,
 * semantic status colours and the pack's structural treatments.
 */
export const DASH_STYLE_VARS = {
  bg: '--dash-bg',
  surface: '--dash-surface',
  ink: '--dash-ink',
  muted: '--dash-muted',
  line: '--dash-line',
  accent: '--dash-accent',
  onAccent: '--dash-on-accent',
  /** The accent mixed toward the background, for washes and selected rows. */
  accentWash: '--dash-accent-wash',
  /** The colour for context data that should recede behind the highlighted subject. */
  context: '--dash-context',
  good: '--dash-good',
  warn: '--dash-warn',
  bad: '--dash-bad',
  fontDisplay: '--dash-font-display',
  fontBody: '--dash-font-body',
  fontMono: '--dash-font-mono',
  /** Font stack for large figures; the display or body face, depending on the pack. */
  fontFigure: '--dash-font-figure',
  figureWeight: '--dash-figure-weight',
  headingWeight: '--dash-heading-weight',
  /** Letter spacing for display headings, for example `-0.02em`. */
  headingTracking: '--dash-heading-tracking',
} as const;

export type DashStyleVar = keyof typeof DASH_STYLE_VARS;

/** `var(--dash-x, fallback)` for use in CSS-in-JS. */
export function dashVar(name: DashStyleVar, fallback: string): string {
  return `var(${DASH_STYLE_VARS[name]}, ${fallback})`;
}

/**
 * Reads a style variable from the element's computed style, for canvas drawing. Returns the
 * fallback when no style is applied.
 */
export function readDashVar(element: Element | null | undefined, name: DashStyleVar, fallback: string): string {
  if (!element) {
    return fallback;
  }
  const value = getComputedStyle(element).getPropertyValue(DASH_STYLE_VARS[name]).trim();
  return value || fallback;
}
