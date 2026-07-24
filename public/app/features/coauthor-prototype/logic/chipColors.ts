import { type GrafanaTheme2 } from '@grafana/data';

import { type ChipRole } from './queryModel';

export interface ChipColor {
  text: string;
  bg: string;
  border: string;
}

/**
 * Role-based color language, shared by the inline chip flow, the query-flow
 * diagram and the explain callouts so the whole prototype reads as one system.
 */
export function chipColor(theme: GrafanaTheme2, role: ChipRole): ChipColor {
  const make = (hex: string): ChipColor => ({
    text: hex,
    bg: alpha(hex, 0.14),
    border: alpha(hex, 0.45),
  });

  switch (role) {
    case 'transform':
      return make(theme.colors.warning.text); // amber — topk / histogram_quantile
    case 'aggregation':
      return make(theme.colors.success.text); // green — sum by(...)
    case 'function':
      return make('#5ac8e8'); // cyan — rate(...)
    case 'metric':
      return make(theme.colors.primary.text); // blue — selector
    case 'range':
      return make('#c08bf5'); // purple — [5m]
    case 'operator':
      return make(theme.colors.error.text); // pink/red — /
    default:
      return { text: theme.colors.text.secondary, bg: 'transparent', border: 'transparent' };
  }
}

function alpha(hex: string, a: number): string {
  const c = hex.replace('#', '');
  const full =
    c.length === 3
      ? c
          .split('')
          .map((x) => x + x)
          .join('')
      : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return hex;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
