import { type DataFrame, FieldType, MutableDataFrame } from '@grafana/data';

const NOW = Date.now();
const STEP = 5 * 60 * 1000; // 5 min step
const POINTS = 72; // 6 hours of 5-min data

function makeTimestamps(): number[] {
  return Array.from({ length: POINTS }, (_, i) => NOW - (POINTS - i) * STEP);
}

function makeFrame(name: string, fields: Array<{ name: string; values: number[] }>): DataFrame {
  const frame = new MutableDataFrame({ name, fields: [] });
  frame.addField({ name: 'time', type: FieldType.time, values: makeTimestamps() });
  for (const f of fields) {
    frame.addField({ name: f.name, type: FieldType.number, values: f.values });
  }
  return frame;
}

function sine(amp: number, period: number, offset = 0): number[] {
  return makeTimestamps().map((_, i) => amp + amp * 0.5 * Math.sin((2 * Math.PI * i) / period + offset));
}

function noise(base: number, range: number): number[] {
  return makeTimestamps().map(() => base + Math.random() * range);
}

function histogramQuantileResult(): DataFrame[] {
  const leValues = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
  const frames: DataFrame[] = [];

  for (const le of leValues) {
    const vals = sine(le * 0.8, 30, le).map((v) => Math.max(0, v));
    frames.push(makeFrame(`le=${le}`, [{ name: 'p95_latency', values: vals }]));
  }
  return frames;
}

function rateResult(): DataFrame[] {
  return [
    makeFrame('http_rate', [{ name: 'req_per_sec', values: sine(120, 40, 0) }]),
    makeFrame('error_rate', [{ name: 'req_per_sec', values: noise(3, 2) }]),
  ];
}

function countResult(): DataFrame {
  return makeFrame('total_requests', [{ name: 'count', values: sine(10000, 36, 1) }]);
}

function defaultTimeseries(): DataFrame[] {
  return [
    makeFrame('A-series', [{ name: 'value', values: sine(50, 20, 0) }]),
    makeFrame('B-series', [{ name: 'value', values: sine(30, 15, 1.5) }]),
  ];
}

export function simulateGithubQuery(sql: string): DataFrame[] {
  const lower = sql.toLowerCase();

  if (/issues/.test(lower)) {
    return githubIssuesResult();
  }
  if (/commits/.test(lower)) {
    return githubCommitsResult();
  }
  if (/workflow_runs/.test(lower)) {
    return githubWorkflowResult();
  }
  return githubPrsByRepoResult();
}

function githubPrsByRepoResult(): DataFrame[] {
  const repos = ['grafana/grafana', 'grafana/loki', 'grafana/tempo', 'grafana/mimir', 'grafana/oncall'];
  const openPrs = [47, 23, 31, 18, 12];
  const avgComments = [3.4, 2.1, 4.7, 1.8, 2.9];
  const latestDates = ['2026-06-10', '2026-06-09', '2026-06-10', '2026-06-08', '2026-06-07'];
  const frame = new MutableDataFrame({ name: 'pr_summary', fields: [] });
  frame.addField({ name: 'repo', type: FieldType.string, values: repos });
  frame.addField({ name: 'open_prs', type: FieldType.number, values: openPrs });
  frame.addField({ name: 'avg_comments', type: FieldType.number, values: avgComments });
  frame.addField({ name: 'latest_pr_date', type: FieldType.string, values: latestDates });
  return [frame];
}

function githubIssuesResult(): DataFrame[] {
  const repos = ['grafana/grafana', 'grafana/loki', 'grafana/tempo', 'grafana/mimir', 'grafana/oncall'];
  const openIssues = [312, 98, 74, 55, 41];
  const avgComments = [5.2, 3.8, 2.9, 4.1, 3.3];
  const frame = new MutableDataFrame({ name: 'issue_summary', fields: [] });
  frame.addField({ name: 'repo', type: FieldType.string, values: repos });
  frame.addField({ name: 'open_issues', type: FieldType.number, values: openIssues });
  frame.addField({ name: 'avg_comments', type: FieldType.number, values: avgComments });
  return [frame];
}

function githubCommitsResult(): DataFrame[] {
  const authors = ['torkel', 'matyax', 'ivanahuckova', 'yavortsvetkov', 'bergquist'];
  const commits = [142, 118, 97, 84, 76];
  const additions = [18420, 14230, 9870, 11340, 8910];
  const deletions = [9210, 7840, 5430, 6720, 4380];
  const frame = new MutableDataFrame({ name: 'commit_summary', fields: [] });
  frame.addField({ name: 'author', type: FieldType.string, values: authors });
  frame.addField({ name: 'commits', type: FieldType.number, values: commits });
  frame.addField({ name: 'additions', type: FieldType.number, values: additions });
  frame.addField({ name: 'deletions', type: FieldType.number, values: deletions });
  return [frame];
}

function githubWorkflowResult(): DataFrame[] {
  const workflows = ['CI / build', 'CI / test', 'Lint', 'E2E', 'Release'];
  const successRates = [98.2, 94.7, 99.1, 87.3, 100.0];
  const avgDurationSec = [312, 487, 145, 924, 1820];
  const runsLast7d = [84, 84, 84, 21, 3];
  const frame = new MutableDataFrame({ name: 'workflow_summary', fields: [] });
  frame.addField({ name: 'workflow', type: FieldType.string, values: workflows });
  frame.addField({ name: 'success_rate_pct', type: FieldType.number, values: successRates });
  frame.addField({ name: 'avg_duration_sec', type: FieldType.number, values: avgDurationSec });
  frame.addField({ name: 'runs_last_7d', type: FieldType.number, values: runsLast7d });
  return [frame];
}

export function simulateQuery(sql: string): DataFrame[] {
  const lower = sql.toLowerCase();

  if (/histogram_quantile/.test(lower)) {
    return histogramQuantileResult();
  }
  if (/rate\s*\(/.test(lower)) {
    return rateResult();
  }
  if (/count\s*\(/.test(lower) || /count_over_time/.test(lower)) {
    return [countResult()];
  }
  return defaultTimeseries();
}

export function getQuerySummary(frames: DataFrame[]): {
  rowCount: number;
  seriesCount: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
} {
  let total = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  let rowCount = 0;

  for (const frame of frames) {
    rowCount += frame.length;
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        for (let i = 0; i < field.values.length; i++) {
          const v = (field.values as number[])[i];
          if (v != null && !isNaN(v)) {
            total += v;
            count++;
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        }
      }
    }
  }

  return {
    rowCount,
    seriesCount: frames.length,
    minValue: min === Infinity ? 0 : +min.toFixed(4),
    maxValue: max === -Infinity ? 0 : +max.toFixed(4),
    avgValue: count > 0 ? +(total / count).toFixed(4) : 0,
  };
}
