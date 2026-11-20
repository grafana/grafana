// Usage: node e2e-playwright/perf-suite/compare.mjs baseline.jsonl candidate.jsonl > summary.json
import { readFileSync } from 'node:fs';

const METRICS = ['wallMs', 'taskMs', 'scriptMs', 'layoutMs', 'styleMs', 'tbtMs', 'maxEventMs', 'heapMb'];

const load = (file) =>
  readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function summarise(rows) {
  const by = Object.groupBy(rows, (r) => r.scenario);
  return Object.fromEntries(
    Object.entries(by).map(([scenario, rs]) => [
      scenario,
      { n: rs.length, ...Object.fromEntries(METRICS.map((m) => [m, median(rs.map((r) => r[m]))])) },
    ])
  );
}

const [baseFile, candFile] = process.argv.slice(2);
const base = summarise(load(baseFile));
const cand = summarise(load(candFile));

const scenarios = Object.keys(base).map((scenario) => ({
  scenario,
  baseline: base[scenario],
  candidate: cand[scenario],
  deltaPct: Object.fromEntries(
    METRICS.map((m) => [
      m,
      base[scenario][m] ? ((cand[scenario]?.[m] - base[scenario][m]) / base[scenario][m]) * 100 : null,
    ])
  ),
}));

console.log(JSON.stringify(scenarios, null, 2));
