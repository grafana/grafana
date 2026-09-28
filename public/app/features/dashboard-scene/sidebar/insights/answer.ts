import { t } from '@grafana/i18n';

import { type InsightAnswer } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Model output is untrusted: validate it before rendering. Throws a user-facing message. */
export function parseInsightAnswer(text: string): InsightAnswer {
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
      findings.push({ label: finding.label, detail: finding.detail });
    }
    if (findings.length === value.findings.length) {
      return { headline: value.headline, findings, caveat: value.caveat };
    }
  }

  throw new Error(
    t('dashboard.insights.answer.unreadable', 'Assistant returned an unreadable insight. Ask again to retry.')
  );
}
