import { t } from '@grafana/i18n';

import { type InsightAnswer, type InsightEvidence, type InsightSnapshot } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toIsoTime(value: unknown): string | undefined {
  const time = isNonEmptyString(value) ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/**
 * Evidence becomes a link, so it must point at a panel in the snapshot and a window within the captured
 * time ranges. Invalid evidence is dropped rather than failing the answer: the finding still stands.
 */
function parseEvidence(value: unknown, snapshot: InsightSnapshot): InsightEvidence | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.panel)) {
    return undefined;
  }
  const panel = value.panel;
  if (!snapshot.panels.some((candidate) => candidate.key === panel)) {
    return undefined;
  }
  const from = toIsoTime(value.from);
  const to = toIsoTime(value.to);
  const earliest = Date.parse(snapshot.previousPeriod?.from ?? snapshot.from);
  const latest = Date.parse(snapshot.to);
  const inRange = (time: string) => Date.parse(time) >= earliest && Date.parse(time) <= latest;
  if (!from || !to || Date.parse(from) >= Date.parse(to) || !inRange(from) || !inRange(to)) {
    return { panel };
  }
  return { panel, from, to };
}

/** One takeaway per breakdown value the snapshot has, in the snapshot's order. */
function parseBreakdown(value: unknown, snapshot: InsightSnapshot): InsightAnswer['breakdown'] {
  const values = snapshot.breakdown?.values;
  if (!values || !Array.isArray(value)) {
    return undefined;
  }
  const headlines = new Map<string, string>();
  for (const item of value) {
    if (!isRecord(item) || !isNonEmptyString(item.value) || !isNonEmptyString(item.headline)) {
      continue;
    }
    const match = values.find((candidate) => candidate.value === item.value || candidate.text === item.value);
    if (match && !headlines.has(match.value)) {
      headlines.set(match.value, item.headline);
    }
  }
  const breakdown = values.flatMap((candidate) => {
    const headline = headlines.get(candidate.value);
    return headline ? [{ value: candidate.text, headline }] : [];
  });
  return breakdown.length ? breakdown : undefined;
}

/** Model output is untrusted: validate it against the snapshot it answers before rendering. Throws a user-facing message. */
export function parseInsightAnswer(text: string, snapshot: InsightSnapshot): InsightAnswer {
  let value: unknown;
  try {
    value = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    value = undefined;
  }

  if (
    isRecord(value) &&
    isNonEmptyString(value.headline) &&
    Array.isArray(value.findings) &&
    value.findings.length >= 1 &&
    value.findings.length <= 3 &&
    typeof value.caveat === 'string'
  ) {
    const findings: InsightAnswer['findings'] = [];
    for (const finding of value.findings) {
      if (!isRecord(finding) || !isNonEmptyString(finding.label) || !isNonEmptyString(finding.detail)) {
        break;
      }
      const evidence = parseEvidence(finding.evidence, snapshot);
      findings.push({ label: finding.label, detail: finding.detail, ...(evidence && { evidence }) });
    }
    if (findings.length === value.findings.length) {
      const breakdown = parseBreakdown(value.breakdown, snapshot);
      return { headline: value.headline, findings, caveat: value.caveat, ...(breakdown && { breakdown }) };
    }
  }

  throw new Error(
    t('dashboard.insights.answer.unreadable', 'Assistant returned an unreadable insight. Ask again to retry.')
  );
}
