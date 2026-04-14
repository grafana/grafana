/**
 * Shared test helpers for barchart panel tests.
 * Used by utils.test.ts, BarChartLegend.test.tsx, BarChartPanel.test.tsx
 */

import { createTheme, type DataFrame, getDisplayProcessor, type GrafanaTheme2 } from '@grafana/data';

/**
 * Ensures custom config exists and sets display processor on frame fields.
 */
export function applyBarChartFieldDefaults(frame: DataFrame, themeOverride?: GrafanaTheme2): void {
  const t = themeOverride ?? createTheme();
  for (const f of frame.fields) {
    f.config.custom = f.config.custom ?? {};
    f.display = getDisplayProcessor({ field: f, theme: t });
  }
}
