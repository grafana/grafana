import { type InsightPanelConfig } from './types';

/**
 * Stand-in for the markdown the insight datasource will return. Echoes the configured
 * context and prompt so it is obvious in the panel which configuration produced it.
 */
export function buildMockInsightMarkdown(config: InsightPanelConfig): string {
  const { prompt, context } = config;
  const subject = context.scope === 'dashboard' ? (context.dashboardTitle ?? 'this dashboard') : 'the selected panels';

  const lines = [
    `# Insights for ${subject}`,
    '',
    `> ${prompt}`,
    '',
    '## Health',
    '',
    '| Target | Status | Notes |',
    '| --- | --- | --- |',
  ];

  if (context.scope === 'dashboard') {
    lines.push(
      `| ${context.dashboardTitle ?? 'Dashboard'} | 🟢 Healthy | All panels returned data on the last refresh. |`
    );
  } else if (context.panels.length === 0) {
    lines.push('| — | ⚪ Unknown | No panels selected yet. |');
  } else {
    for (const panel of context.panels) {
      lines.push(`| ${panel.panelTitle} | 🟢 Healthy | Query succeeded, data within expected range. |`);
    }
  }

  lines.push(
    '',
    '## What this measures',
    '',
    context.scope === 'dashboard'
      ? 'This dashboard tracks the service golden signals — traffic, latency, errors and saturation — for the selected environment.'
      : 'The selected panels track request latency and error rate for the selected service.',
    '',
    '_Mocked response. Replace the TestData DB query with the insight datasource to get real answers._'
  );

  return lines.join('\n');
}
