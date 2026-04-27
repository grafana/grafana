/**
 * Shared test helpers for barchart panel tests.
 * Used by utils.test.ts, BarChartLegend.test.tsx, BarChartPanel.test.tsx
 */

import { type DataFrame } from '@grafana/data/dataframe';
import { getDisplayProcessor } from '@grafana/data/field';
import { createTheme, type GrafanaTheme2 } from '@grafana/data/themes';

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
