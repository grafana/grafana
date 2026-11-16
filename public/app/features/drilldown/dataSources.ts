import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList, getDefaultDataSourceInstanceListItem, locationService } from '@grafana/runtime';

export type Signal = 'metrics' | 'logs' | 'traces' | 'profiles' | 'knowledgegraph' | 'sql';

export const SIGNALS: Signal[] = ['metrics', 'logs', 'traces', 'profiles', 'knowledgegraph', 'sql'];

// SQL stays on the Home page because it is a Drilldown app, but how it fits the OTel or service story is not settled.
// Nothing ties a database to a service, so a first load never picks one by name or by default: the user chooses it.
type RelatedSignal = Exclude<Signal, 'sql'>;
const RELATED_SIGNALS: RelatedSignal[] = ['metrics', 'logs', 'traces', 'profiles', 'knowledgegraph'];

// The plugin ids a data source can have to answer each signal's queries.
export const SIGNAL_TYPES: Record<Signal, string[]> = {
  metrics: ['prometheus'],
  logs: ['loki'],
  traces: ['tempo'],
  profiles: ['grafana-pyroscope-datasource'],
  knowledgegraph: ['grafana-knowledgegraph-datasource'],
  sql: ['mysql', 'grafana-postgresql-datasource', 'mssql'],
};

// The chosen data sources live in the URL as variables, the same `var-` form the Drilldown apps read.
export const dataSourceParam = (signal: Signal) => `var-ds-${signal}`;

type Option = Pick<DataSourceInstanceListItem, 'uid' | 'name'>;
type Options = Record<RelatedSignal, Option[]>;
type Choice = Partial<Record<Signal, string>>;

// Words that name the signal a data source serves. What remains of a name says which group it belongs to, so
// grafanacloud-prom and grafanacloud-logs share the stem grafanacloud.
const SIGNAL_WORDS = new Set([
  'prom',
  'prometheus',
  'mimir',
  'cortex',
  'metrics',
  'logs',
  'logging',
  'loki',
  'traces',
  'tracing',
  'tempo',
  'profiles',
  'profile',
  'pyroscope',
  'knowledgegraph',
  'kg',
  'datasource',
]);

// The first label of the host is the stack's own word, such as ops in ops.grafana-ops.net. Every data source there
// can carry it, so it says nothing about which data sources belong together.
function stackWord(): string {
  return window.location.hostname.split('.')[0].toLowerCase();
}

export function nameStem(name: string, ignoredWords: string[] = []): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !SIGNAL_WORDS.has(word) && !ignoredWords.includes(word))
    .join('-');
}

// Compares score lists from the first entry on.
const compare = (a: number[], b: number[]) => a.reduce((result, value, index) => result || value - b[index], 0);

// The stem that covers the most signals wins, so a first load lands on one group of data sources instead of a mix.
// A stem the user already chose from comes first, then the one holding the instance defaults, then the name order.
// With no stem shared by two signals the names say nothing, and no group is chosen.
export function chooseRelated(
  options: Options,
  defaults: Choice,
  anchorStems: string[],
  ignoredWords: string[] = []
): Choice {
  const groups = new Map<string, Choice>();
  for (const signal of RELATED_SIGNALS) {
    for (const option of options[signal]) {
      const stem = nameStem(option.name, ignoredWords);
      if (stem) {
        const group = groups.get(stem) ?? {};
        group[signal] ??= option.uid;
        groups.set(stem, group);
      }
    }
  }

  let best: { stem: string; group: Choice; score: number[] } | undefined;
  for (const [stem, group] of groups) {
    const covered = RELATED_SIGNALS.filter((signal) => group[signal]);
    if (covered.length < 2) {
      continue;
    }
    const score = [
      anchorStems.includes(stem) ? 1 : 0,
      covered.length,
      covered.filter((signal) => group[signal] === defaults[signal]).length,
    ];
    const order = best ? compare(score, best.score) : 1;
    if (order > 0 || (order === 0 && best && stem < best.stem)) {
      best = { stem, group, score };
    }
  }
  return best?.group ?? {};
}

export async function listDataSources(signal: Signal): Promise<DataSourceInstanceListItem[]> {
  const items = await getDataSourceInstanceList({ type: SIGNAL_TYPES[signal], all: true });
  // The list adds the built-in Grafana data source to every result, so only the signal's own types are kept.
  return items.filter((item) => SIGNAL_TYPES[signal].includes(item.type));
}

// The uid the URL holds for a signal, read straight from the URL so links and queries agree.
export function getUrlDataSource(signal: Signal): string | undefined {
  const value = locationService.getSearchObject()[dataSourceParam(signal)];
  return typeof value === 'string' && value ? value : undefined;
}

// The URL is the only source of the choice: a uid that no longer names a data source of the type counts as none.
export async function getSelectedDataSource(signal: Signal): Promise<string | undefined> {
  const uid = getUrlDataSource(signal);
  const options = await listDataSources(signal);
  return options.some((option) => option.uid === uid) ? uid : undefined;
}

export async function requireDataSource(signal: Signal): Promise<string> {
  const uid = await getSelectedDataSource(signal);
  if (!uid) {
    throw new Error(`No ${SIGNAL_TYPES[signal].join(' or ')} data source is selected for ${signal}`);
  }
  return uid;
}

// The data sources to start from for every related signal the URL does not already settle: related by name first,
// and the instance default of the type for a signal the related group lacks. A signal with neither stays unset.
export async function suggestDataSources(): Promise<Choice> {
  const ignoredWords = [stackWord()];
  const listed = await Promise.all(RELATED_SIGNALS.map((signal) => listDataSources(signal)));
  const options: Record<RelatedSignal, DataSourceInstanceListItem[]> = {
    metrics: [],
    logs: [],
    traces: [],
    profiles: [],
    knowledgegraph: [],
  };
  RELATED_SIGNALS.forEach((signal, index) => {
    options[signal] = listed[index];
  });
  const defaultItems = await Promise.all(
    RELATED_SIGNALS.map((signal) => getDefaultDataSourceInstanceListItem(options[signal]))
  );
  const defaults: Choice = {};
  RELATED_SIGNALS.forEach((signal, index) => {
    const item = defaultItems[index];
    if (item) {
      defaults[signal] = item.uid;
    }
  });

  const settled: Choice = {};
  const anchorStems: string[] = [];
  for (const signal of RELATED_SIGNALS) {
    const option = options[signal].find((candidate) => candidate.uid === getUrlDataSource(signal));
    if (option) {
      settled[signal] = option.uid;
      anchorStems.push(nameStem(option.name, ignoredWords));
    }
  }

  const related = chooseRelated(options, defaults, anchorStems, ignoredWords);
  const suggestion: Choice = {};
  for (const signal of RELATED_SIGNALS) {
    const uid = related[signal] ?? defaults[signal];
    if (!settled[signal] && uid) {
      suggestion[signal] = uid;
    }
  }
  return suggestion;
}
