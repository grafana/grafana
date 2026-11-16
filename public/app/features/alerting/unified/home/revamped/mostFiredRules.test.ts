import {
  buildFiringTrendQuery,
  buildMostFiredQuery,
  combineMostFired,
  countFiringFromHistory,
  fillSteps,
} from './mostFiredRules';

describe('buildMostFiredQuery', () => {
  it('counts how often each rule fired over the whole range', () => {
    expect(buildMostFiredQuery(604800)).toBe(
      'topk(5, sum by (labels_alertname, ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` [604800s])))'
    );
  });
});

describe('buildFiringTrendQuery', () => {
  it('counts firing transitions per step for the given rules only', () => {
    expect(buildFiringTrendQuery(['cpu', 'disk-1'], 3600)).toBe(
      'sum by (ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` | ruleUID =~ `cpu|disk-1` [3600s]))'
    );
  });
});

describe('combineMostFired', () => {
  it('ranks rules by how often they fired and attaches each rule its own trend', () => {
    const rules = combineMostFired(
      [
        { labels: { labels_alertname: 'Disk full', ruleUID: 'disk' }, values: [12], times: [0] },
        { labels: { labels_alertname: 'CPU high', ruleUID: 'cpu' }, values: [40], times: [0] },
      ],
      [
        { labels: { ruleUID: 'cpu' }, values: [10, 30], times: [0, 60000] },
        { labels: { ruleUID: 'disk' }, values: [5, 7], times: [0, 60000] },
      ]
    );

    expect(rules).toEqual([
      { uid: 'cpu', name: 'CPU high', timesFired: 40, trend: [10, 30] },
      { uid: 'disk', name: 'Disk full', timesFired: 12, trend: [5, 7] },
    ]);
  });

  it('leaves the trend empty for a rule the trend query returned nothing for', () => {
    const [rule] = combineMostFired(
      [{ labels: { labels_alertname: 'CPU high', ruleUID: 'cpu' }, values: [3], times: [0] }],
      []
    );
    expect(rule.trend).toEqual([]);
  });
});

describe('fillSteps', () => {
  it('puts a zero in every step Loki returned nothing for, so a rule that fired once still draws a line', () => {
    expect(fillSteps({ times: [120_000], values: [1] }, 0, 240_000, 60_000)).toEqual([0, 0, 1, 0, 0]);
  });

  it('places each value in the step its timestamp falls in', () => {
    expect(fillSteps({ times: [0, 61_000], values: [3, 4] }, 0, 120_000, 60_000)).toEqual([3, 4, 0]);
  });
});

describe('countFiringFromHistory', () => {
  const fired = (time: number, ruleUID: string, ruleTitle: string, current = 'Alerting') => ({
    time,
    line: { ruleUID, ruleTitle, current, previous: 'Normal' },
  });
  const frame = (events: Array<ReturnType<typeof fired>>) => ({
    data: { values: [events.map((event) => event.time), events.map((event) => event.line), events.map(() => ({}))] },
  });

  it('counts firing transitions per rule, most fired first, with a trend over the range', () => {
    const result = countFiringFromHistory(
      frame([
        fired(0, 'cpu', 'CPU high'),
        fired(60_000, 'cpu', 'CPU high'),
        fired(120_000, 'disk', 'Disk full'),
        fired(130_000, 'cpu', 'CPU high'),
      ]),
      { fromMs: 0, toMs: 120_000, stepMs: 60_000, limit: 5000 }
    );

    expect(result).toEqual({
      capped: false,
      rules: [
        { uid: 'cpu', name: 'CPU high', timesFired: 3, trend: [1, 1, 1] },
        { uid: 'disk', name: 'Disk full', timesFired: 1, trend: [0, 0, 1] },
      ],
    });
  });

  it('ignores transitions into other states and keeps only the top five rules', () => {
    const events = [fired(0, 'normal', 'Recovered', 'Normal')];
    for (let rule = 1; rule <= 6; rule++) {
      for (let times = 0; times < rule; times++) {
        events.push(fired(0, `rule-${rule}`, `Rule ${rule}`));
      }
    }

    const { rules } = countFiringFromHistory(frame(events), { fromMs: 0, toMs: 60_000, stepMs: 60_000, limit: 5000 });

    expect(rules.map((rule) => rule.uid)).toEqual(['rule-6', 'rule-5', 'rule-4', 'rule-3', 'rule-2']);
  });

  it('says the counts are partial when the history response hit its limit', () => {
    const events = [fired(0, 'cpu', 'CPU high'), fired(1, 'cpu', 'CPU high')];
    expect(countFiringFromHistory(frame(events), { fromMs: 0, toMs: 60_000, stepMs: 60_000, limit: 2 }).capped).toBe(
      true
    );
  });
});
