import { isInvestigationFinished } from '@grafana/assistant';

import { type InsightInvestigation, type InsightResult } from './types';

const MAX_TITLE_LENGTH = 100;

/** The id of a started investigation that is still running, whose state is worth polling. */
export function getRunningInvestigationId(investigation: InsightInvestigation | undefined): string | undefined {
  return investigation?.phase === 'started' && !isInvestigationFinished(investigation.state)
    ? investigation.investigationId
    : undefined;
}

/** A new investigation can start once the previous one has finished or failed to start. */
export function canStartInvestigation(investigation: InsightInvestigation | undefined): boolean {
  return investigation?.phase !== 'starting' && getRunningInvestigationId(investigation) === undefined;
}

/** Shapes the lens view of a finished investigation. Field descriptions are instructions to the model. */
export const INVESTIGATION_SUMMARY_SCHEMA = {
  type: 'object',
  required: ['summary', 'rootCause', 'nextSteps'],
  properties: {
    summary: {
      type: 'string',
      description: 'What the investigation found, in one or two sentences, at most 40 words.',
    },
    rootCause: {
      type: 'string',
      description: 'The most likely cause in at most 25 words, or an empty string when the investigation found none.',
    },
    nextSteps: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', description: 'One recommended action, at most 15 words.' },
    },
  },
} as const;

function formatWindow(from?: string, to?: string) {
  return from && to ? `, ${from} to ${to}` : '';
}

/**
 * The investigation starts from what the answer saw: the question, the answer and its evidence, and where the
 * data came from. Model input, so it is not translated.
 */
export function buildInsightInvestigation(
  dashboardTitle: string,
  result: InsightResult
): { title: string; instruction: string } {
  const { content, snapshot } = result;
  const panelTitle = (key: string) => snapshot.panels.find((panel) => panel.key === key)?.title ?? key;
  const variables = Object.entries(snapshot.variables);

  const lines = [
    'Investigate this Grafana dashboard insight: verify its findings against the underlying data and look for the cause.',
    '',
    `Dashboard: ${dashboardTitle}`,
    `Dashboard link: ${result.sourceLocation}`,
    `Time range (UTC): ${snapshot.from} to ${snapshot.to}`,
    ...(variables.length ? [`Variables: ${variables.map(([name, value]) => `${name}=${value}`).join(', ')}`] : []),
    `Source panels: ${snapshot.panels.map((panel) => (panel.section ? `${panel.title} (${panel.section})` : panel.title)).join('; ')}`,
    ...(snapshot.previousPeriod
      ? [`Compared with the previous period: ${snapshot.previousPeriod.from} to ${snapshot.previousPeriod.to}`]
      : []),
    '',
    `Question: ${snapshot.question}`,
    `Answer: ${content.headline}`,
    'Findings:',
    ...content.findings.map((finding) => {
      const evidence = finding.evidence
        ? ` (${panelTitle(finding.evidence.panel)}${formatWindow(finding.evidence.from, finding.evidence.to)})`
        : '';
      return `- ${finding.label}: ${finding.detail}${evidence}`;
    }),
    ...(content.breakdown?.length && snapshot.breakdown
      ? [`By ${snapshot.breakdown.variable}:`, ...content.breakdown.map((item) => `- ${item.value}: ${item.headline}`)]
      : []),
    ...(content.caveat ? [`Caveat: ${content.caveat}`] : []),
    '',
    'The answer was based only on the data the panels showed. Query the data sources before drawing conclusions.',
  ];

  const title = `Insight: ${snapshot.question}`;
  return {
    title: title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title,
    instruction: lines.join('\n'),
  };
}
