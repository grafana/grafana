// Prototype-only. Not internationalized.
// Mocked "assistant response" data + shape-prediction rules for Option C.

import { detectMetricInExpr } from './prometheusMockCatalog';

export interface AssistantStep {
  label: string; // Short label — e.g. "Traffic"
  query: string; // PromQL expression
}

export interface AssistantPlan {
  framing: string; // One-line intro shown above the steps
  steps: AssistantStep[]; // 1..n steps; a single-step plan renders without the "Add all" button
}

// ---- Shape prediction ---------------------------------------------------

const RATE_WRAPPER_RE = /\b(rate|irate)\s*\(/;
const HIST_QUANTILE_RE = /\bhistogram_quantile\s*\(/;
const BY_CLAUSE_RE = /\bby\s*\(\s*([a-zA-Z_][a-zA-Z0-9_,\s]*)\)/;

export function shapePrediction(query: string): string {
  const hasHistQuantile = HIST_QUANTILE_RE.test(query);
  if (hasHistQuantile) {
    return 'Expect one estimated line — can jump between scrapes if traffic is low.';
  }

  const detectedMetric = detectMetricInExpr(query);
  const type = detectedMetric?.type;
  const hasRate = RATE_WRAPPER_RE.test(query);
  const byMatch = query.match(BY_CLAUSE_RE);

  if (type === 'counter' && hasRate && byMatch) {
    const labels = byMatch[1].trim();
    return `Expect one line per {${labels}}.`;
  }
  if (type === 'counter' && hasRate) {
    return 'Expect one line, trending up or down with volume.';
  }
  if (type === 'gauge' && !hasRate) {
    return 'Expect a single value that may fluctuate around a baseline.';
  }
  return 'Expect a time series shaped by your query.';
}

// ---- Starter prompts + responses ----------------------------------------

export interface StarterPrompt {
  label: string;
  question: string;
}

export const STARTERS: StarterPrompt[] = [
  { label: 'What can I monitor with this data source?', question: 'What can I monitor with this data source?' },
  { label: 'Is my data source connected?', question: 'Is my data source connected?' },
  { label: 'Show me my traffic', question: 'Show me my traffic' },
];

// Rough classifier — matches the user's typed question against a small set of
// mocked responses. Falls back to a generic single-query plan on unknown input.
export function planFor(question: string): AssistantPlan {
  const q = question.trim().toLowerCase();

  if (q.includes('what can i monitor')) {
    return {
      framing:
        "To get a first sense of what's happening, let's start with traffic — then look at latency and resources.",
      steps: [
        { label: 'Traffic', query: 'rate(http_server_requests_seconds_count[5m])' },
        {
          label: 'Latency',
          query: 'histogram_quantile(0.99, rate(grpc_server_handling_seconds_bucket[5m]))',
        },
        { label: 'Resources', query: 'avg(rate(node_cpu_seconds_total[5m])) by (instance)' },
      ],
    };
  }

  if (q.includes('connect')) {
    return {
      framing: 'A quick health check — this should return 1 for every reachable target.',
      steps: [{ label: 'Connection', query: 'up' }],
    };
  }

  if (q.includes('traffic')) {
    return {
      framing: 'Requests per second across the HTTP server.',
      steps: [{ label: 'Traffic', query: 'rate(http_server_requests_seconds_count[5m])' }],
    };
  }

  // Fallback — treat the question as a broad exploration prompt.
  return {
    framing: `Here's a starting point for "${question.trim()}".`,
    steps: [{ label: 'Starting point', query: 'up' }],
  };
}
