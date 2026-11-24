import { colorManipulator, createTheme, type GrafanaTheme2 } from '@grafana/data';

import { findOption, getStylePack } from './packs';
import { type DashboardStyleChoice, type ResolvedDashboardStyle, type StyleColors } from './types';

/**
 * Resolves a saved choice, optionally overridden by the viewer, for the current lighting mode.
 * Unknown ids fall back to the pack defaults, so a dashboard saved with a newer pack option still
 * renders. An unknown pack resolves to nothing and the dashboard keeps the Grafana theme.
 */
export function resolveDashboardStyle(
  choice: DashboardStyleChoice | undefined,
  hostTheme: GrafanaTheme2
): ResolvedDashboardStyle | undefined {
  const pack = getStylePack(choice?.pack);
  if (!pack) {
    return undefined;
  }

  const palette =
    findOption(pack.palettes, choice?.palette) ?? findOption(pack.palettes, pack.defaults.palette) ?? pack.palettes[0];
  const typography =
    findOption(pack.typography, choice?.typography) ??
    findOption(pack.typography, pack.defaults.typography) ??
    pack.typography[0];
  const accent = findOption(pack.accents, choice?.accent);
  const mode = hostTheme.isDark ? 'dark' : 'light';

  const base: StyleColors = palette.host ? hostColors(hostTheme, palette[mode]) : palette[mode];
  const colors: StyleColors = { ...base, accent: accent ? accent[mode] : base.accent };

  return { pack, palette, accent, typography, mode, colors };
}

function hostColors(theme: GrafanaTheme2, fallback: StyleColors): StyleColors {
  return {
    ...fallback,
    bg: theme.colors.background.canvas,
    surface: theme.colors.background.primary,
    ink: theme.colors.text.primary,
    muted: theme.colors.text.secondary,
    line: theme.colors.border.weak,
    good: theme.visualization.getColorByName('green'),
    warn: theme.visualization.getColorByName('orange'),
    bad: theme.visualization.getColorByName('red'),
    series: theme.visualization.palette,
  };
}

/**
 * The Grafana theme panels render with inside a styled dashboard. It carries the palette's
 * surfaces, text and lines, the series palette, the body and monospace faces, and, for open packs,
 * chrome-less panels.
 */
export function createStyleTheme(style: ResolvedDashboardStyle, hostTheme: GrafanaTheme2): GrafanaTheme2 {
  const { colors, typography, pack, palette } = style;
  const isOpen = pack.treatments.surface === 'open';
  const mix = (amount: number) => colorManipulator.alpha(colors.ink, amount);

  return createTheme({
    name: `${hostTheme.name} · ${pack.name}`,
    colors: palette.host
      ? { mode: style.mode }
      : {
          mode: style.mode,
          background: {
            canvas: colors.bg,
            primary: colors.surface,
            secondary: colorManipulator.onBackground(mix(0.04), colors.surface).toHexString(),
            elevated: colorManipulator.onBackground(mix(0.06), colors.surface).toHexString(),
          },
          text: {
            primary: colors.ink,
            secondary: colors.muted,
            disabled: colorManipulator.alpha(colors.muted, 0.7),
            maxContrast: colors.ink,
          },
          border: {
            weak: colors.line,
            medium: mix(0.22),
            strong: mix(0.34),
          },
        },
    typography: {
      fontFamily: typography.body,
      fontFamilyMonospace: typography.mono,
    },
    visualization: { palette: colors.series },
    // Open surfaces paint panels in the canvas colour rather than `transparent`: visualizations
    // such as bar gauges derive colours from the panel background and need a real colour.
    components: isOpen ? { panel: { background: colors.bg, borderColor: colors.bg, boxShadow: 'none' } } : undefined,
  });
}

/** CSS custom properties the canvas sets for elements that read style tokens directly. */
export function getStyleCssVars(style: ResolvedDashboardStyle): Record<string, string> {
  const { colors, typography } = style;
  return {
    '--dash-bg': colors.bg,
    '--dash-surface': colors.surface,
    '--dash-ink': colors.ink,
    '--dash-muted': colors.muted,
    '--dash-line': colors.line,
    '--dash-accent': colors.accent,
    '--dash-on-accent': readableOn(colors.accent),
    '--dash-accent-wash': colorManipulator.alpha(colors.accent, style.mode === 'dark' ? 0.16 : 0.1),
    '--dash-context': colorManipulator.alpha(colors.muted, style.mode === 'dark' ? 0.55 : 0.5),
    '--dash-good': colors.good,
    '--dash-warn': colors.warn,
    '--dash-bad': colors.bad,
    '--dash-font-display': typography.display,
    '--dash-font-body': typography.body,
    '--dash-font-mono': typography.mono,
    '--dash-font-figure': typography.figure === 'display' ? typography.display : typography.body,
    '--dash-figure-weight': String(typography.figureWeight),
    '--dash-heading-weight': String(typography.headingWeight),
    '--dash-heading-tracking': typography.headingTracking,
  };
}

function readableOn(color: string): string {
  return colorManipulator.getContrastRatio('#000000', color) >= colorManipulator.getContrastRatio('#ffffff', color)
    ? '#000000'
    : '#ffffff';
}
