import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import { type LabelCategory, categorizeLabelKey, descriptionForLabelKey, titleForLabelKey } from './analysis';
import { type CloudSignal, type DatabaseSignal, type RuntimeSignal } from './capabilities';
import { CAPABILITY_INTENTS, INTENTS_BY_CATEGORY } from './intents';
import {
  type DashboardIntent,
  type DatasourceAnalysis,
  type ExplorationOption,
  type GeneratedCategoryGroup,
  type IntentSelection,
} from './types';

/**
 * A semantic "domain" of the observability stack — Apps, Databases, Kubernetes,
 * Cloud, and so on — rather than a raw label dimension. Domains are assembled
 * either from LLM-generated categories (primary path) or from the detected
 * capabilities plus label dimensions (fallback path used when the Assistant is
 * unavailable): we only surface a domain when the datasource actually carries
 * signals for it, and each intent inside a domain remembers which label it
 * pivots on (so a Kubernetes domain can mix pod-, namespace- and node-scoped
 * shapes).
 *
 * This is the organising principle the wizard shows first — "Databases", "Apps",
 * "Business KPIs" — which is far more meaningful to a user than "Namespaces" or
 * "Pods".
 */
export interface DomainGroup {
  /** Stable id used as a React key and telemetry dimension. */
  id: string;
  /** Translated, human-readable domain title (e.g. "Databases"). */
  title: string;
  /** Icon shown in the group header. */
  icon: IconName;
  /**
   * Dynamic hint shown muted after the title — either the detected systems
   * ("PostgreSQL, Redis") or a few sample label values. Not translated: it's data
   * (proper nouns / label values), not UI copy.
   */
  samplePreview?: string;
  /** The (intent, pivot) picks this domain offers, already de-duplicated. */
  selections: IntentSelection[];
}

/**
 * Adapts LLM-generated categories to the modal's `DomainGroup` shape. This is
 * the primary path: `useIntentSuggestions` returns categories rooted in the
 * datasource's actual data, and the modal renders them as domain groups.
 *
 * We coerce the raw icon string to an `IconName` via the same allow-list the
 * suggestion parser used, so any invalid icon that snuck through still becomes a
 * safe fallback here.
 */
export function domainGroupsFromCategories(categories: GeneratedCategoryGroup[]): DomainGroup[] {
  return categories
    .filter((category) => category.selections.length > 0)
    .map((category) => ({
      id: `generated-${category.id}`,
      title: category.title,
      icon: coerceIcon(category.icon),
      samplePreview: category.description,
      selections: category.selections,
    }));
}

/**
 * Coerces an arbitrary icon string (from LLM output) to the small set of icons
 * we render in the group header. Anything unrecognised falls back to a generic
 * layer-group icon so the UI never breaks on an unexpected value.
 */
function coerceIcon(input: string): IconName {
  const allowed: readonly IconName[] = [
    'apps',
    'sitemap',
    'database',
    'exchange-alt',
    'kubernetes',
    'laptop-cloud',
    'cloud',
    'process',
    'shield',
    'dollar-alt',
    'chart-line',
    'graph-bar',
    'layer-group',
    'bell',
    'clock-nine',
    'history',
    'list-ul',
    'columns',
    'monitor',
    'exclamation-triangle',
  ];
  for (const icon of allowed) {
    if (icon === input) {
      return icon;
    }
  }
  return 'layer-group';
}

/** Keep each domain scannable — a wall of cards defeats the point of grouping. */
const MAX_INTENTS_PER_DOMAIN = 6;

/** Display names for detected systems. Proper nouns, so intentionally untranslated. */
const DATABASE_TITLES: Record<DatabaseSignal, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  redis: 'Redis',
  mongodb: 'MongoDB',
  kafka: 'Kafka',
  elasticsearch: 'Elasticsearch',
  cassandra: 'Cassandra',
};

const RUNTIME_TITLES: Record<RuntimeSignal, string> = {
  go: 'Go',
  jvm: 'JVM',
  nodejs: 'Node.js',
  python: 'Python',
  dotnet: '.NET',
  ruby: 'Ruby',
};

const CLOUD_TITLES: Record<CloudSignal, string> = {
  aws: 'AWS',
  gcp: 'Google Cloud',
  azure: 'Azure',
};

/** Which curated capability intents each database/runtime maps to. */
const DATABASE_INTENT_IDS: Partial<Record<DatabaseSignal, string[]>> = {
  postgres: ['postgres-query-performance', 'postgres-connections-locks'],
  mysql: ['mysql-overview'],
  redis: ['redis-overview'],
  mongodb: ['mongodb-overview'],
};

const RUNTIME_INTENT_IDS: Partial<Record<RuntimeSignal, string>> = {
  go: 'go-runtime-deep-dive',
  jvm: 'jvm-runtime-deep-dive',
  nodejs: 'nodejs-runtime',
  python: 'python-runtime',
  dotnet: 'dotnet-runtime',
  ruby: 'ruby-runtime',
};

/**
 * Fallback builder — used when the data-driven generator (`generateIntents.ts`)
 * is unavailable (Assistant off) or returns nothing. Builds domain groups
 * directly from the detected capabilities plus label dimensions using the
 * static curated intents in `intents.ts`. Order is deliberate: application-level
 * concerns first (what most users came for), then backing systems, then
 * infrastructure, and finally a generic "explore by label" catch-all so no
 * dimension is ever unreachable.
 *
 * The primary path is `domainGroupsFromCategories`, which adapts the LLM's
 * generated categories to the same `DomainGroup` shape.
 */
export function buildDomainGroups(analysis: DatasourceAnalysis): DomainGroup[] {
  const caps = analysis.capabilities;
  const groups: DomainGroup[] = [];

  // Apps & services — RED/USE shapes for anything that looks like a service.
  const serviceOption = findOption(analysis, ['service', 'job']);
  const appsPresent =
    !!serviceOption || caps.metricConventions.includes('opentelemetry') || caps.serviceMesh.length > 0;
  if (appsPresent) {
    const pivot = pivotOption(analysis, ['service', 'job'], 'service');
    const intents: Array<DashboardIntent | undefined> = [];
    if (caps.metricConventions.includes('opentelemetry')) {
      intents.push(capabilityIntent('otel-red-semconv'));
    }
    intents.push(...INTENTS_BY_CATEGORY.service);
    if (caps.serviceMesh.includes('istio')) {
      intents.push(capabilityIntent('istio-service-mesh'));
    } else if (caps.serviceMesh.includes('envoy')) {
      intents.push(capabilityIntent('envoy-proxy'));
    }
    pushDomain(groups, {
      id: 'apps',
      title: t('dashboard-generate.domains.apps', 'Apps & services'),
      icon: 'apps',
      samplePreview: samplePreview(pivot),
      selections: toSelections(intents, pivot),
    });
  }

  // Databases — one pivot, the DB-specific capability intents.
  const databases = caps.databases.filter((db) => db !== 'kafka');
  if (databases.length > 0) {
    const pivot = pivotOption(analysis, ['service', 'job', 'instance', 'namespace', 'pod'], 'instance');
    const intents = databases.flatMap((db) => DATABASE_INTENT_IDS[db] ?? []).map(capabilityIntent);
    pushDomain(groups, {
      id: 'databases',
      title: t('dashboard-generate.domains.databases', 'Databases'),
      icon: 'database',
      samplePreview: databases.map((db) => DATABASE_TITLES[db]).join(', '),
      selections: toSelections(intents, pivot),
    });
  }

  // Streaming & messaging — Kafka today, room for more brokers later.
  if (caps.databases.includes('kafka')) {
    const pivot = pivotOption(analysis, ['service', 'job', 'instance'], 'instance');
    const intents = ['kafka-consumer-lag', 'kafka-broker-health'].map(capabilityIntent);
    pushDomain(groups, {
      id: 'messaging',
      title: t('dashboard-generate.domains.messaging', 'Streaming & messaging'),
      icon: 'exchange-alt',
      samplePreview: DATABASE_TITLES.kafka,
      selections: toSelections(intents, pivot),
    });
  }

  // Kubernetes — a curated mix across the dimensions that are actually present,
  // each card pivoting on its own K8s label.
  if (caps.kubernetes.detected) {
    const cluster = findOption(analysis, ['cluster']);
    const namespace = findOption(analysis, ['namespace']);
    const workload = findOption(analysis, ['deployment']);
    const pod = findOption(analysis, ['pod']);
    const node = findOption(analysis, ['node']);

    const selections: IntentSelection[] = [];
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.cluster, 'cluster-overview'), cluster);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.namespace, 'resource-usage'), namespace);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.namespace, 'workload-overview'), namespace);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.deployment, 'deployment-rollout'), workload);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.pod, 'pod-resources'), pod);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.pod, 'pod-lifecycle'), pod);
    addSelection(selections, intentById(INTENTS_BY_CATEGORY.node, 'node-overview'), node);
    if (caps.kubernetes.apiServer) {
      addSelection(selections, intentById(INTENTS_BY_CATEGORY.cluster, 'cluster-control-plane'), cluster);
    }

    pushDomain(groups, {
      id: 'kubernetes',
      title: t('dashboard-generate.domains.kubernetes', 'Kubernetes'),
      icon: 'kubernetes',
      samplePreview: samplePreview(namespace ?? pod ?? cluster ?? node),
      selections: selections.slice(0, MAX_INTENTS_PER_DOMAIN),
    });
  }

  // Hosts & infrastructure — bare-metal / VM node-exporter style host metrics.
  const hostOption = findOption(analysis, ['instance']);
  if (hostOption || caps.kubernetes.nodeExporter) {
    const pivot = hostOption ?? pivotOption(analysis, ['instance', 'node'], 'instance');
    pushDomain(groups, {
      id: 'hosts',
      title: t('dashboard-generate.domains.hosts', 'Hosts & infrastructure'),
      icon: 'laptop-cloud',
      samplePreview: samplePreview(pivot),
      selections: toSelections([...INTENTS_BY_CATEGORY.instance], pivot),
    });
  }

  // Language runtimes — per-language deep dives when we detect the SDK/exporter.
  if (caps.runtimes.length > 0) {
    const pivot = pivotOption(analysis, ['service', 'pod', 'instance', 'job'], 'service');
    const intents = caps.runtimes.map((runtime) => RUNTIME_INTENT_IDS[runtime]).map(capabilityIntent);
    pushDomain(groups, {
      id: 'runtimes',
      title: t('dashboard-generate.domains.runtimes', 'Language runtimes'),
      icon: 'process',
      samplePreview: caps.runtimes.map((runtime) => RUNTIME_TITLES[runtime]).join(', '),
      selections: toSelections(intents, pivot),
    });
  }

  // Cloud — provider-specific overview, or a generic breakdown as a fallback.
  if (caps.clouds.length > 0) {
    const pivot = pivotOption(analysis, ['service', 'instance', 'namespace'], 'instance');
    const intents: Array<DashboardIntent | undefined> = [];
    if (caps.clouds.includes('aws')) {
      intents.push(capabilityIntent('aws-cloudwatch-overview'));
    }
    if (!intents.some(Boolean)) {
      intents.push(intentById(INTENTS_BY_CATEGORY.other, 'label-overview'));
    }
    pushDomain(groups, {
      id: 'cloud',
      title: t('dashboard-generate.domains.cloud', 'Cloud'),
      icon: 'cloud',
      samplePreview: caps.clouds.map((cloud) => CLOUD_TITLES[cloud]).join(', '),
      selections: toSelections(intents, pivot),
    });
  }

  // Explore by label — a catch-all so custom label dimensions no domain claimed
  // (tenants, regions, queues, routes…) stay reachable, and the modal is never
  // empty when we detected *something*.
  const explore = buildExploreByLabel(analysis, groups);
  if (explore) {
    groups.push(explore);
  }

  // Cross-domain de-dupe: the same (intent, pivot) should never appear twice.
  return dedupeAcrossGroups(groups).filter((group) => group.selections.length > 0);
}

function buildExploreByLabel(analysis: DatasourceAnalysis, groups: DomainGroup[]): DomainGroup | undefined {
  if (analysis.options.length === 0) {
    return undefined;
  }
  const overview = intentById(INTENTS_BY_CATEGORY.other, 'label-overview');
  const selections: IntentSelection[] = [];

  if (groups.length === 0) {
    // Nothing recognised — offer the full generic set on the top-ranked label.
    selections.push(...toSelections([...INTENTS_BY_CATEGORY.other], analysis.options[0]));
  } else if (overview) {
    // Offer a generic overview for each uncategorised label a domain didn't cover.
    const covered = new Set(groups.flatMap((group) => group.selections.map((s) => s.option.labelKey)));
    for (const option of analysis.options) {
      if (!covered.has(option.labelKey) && categorizeLabelKey(option.labelKey) === 'other') {
        selections.push({ intent: overview, option });
      }
    }
  }

  if (selections.length === 0) {
    return undefined;
  }
  return {
    id: 'general',
    title: t('dashboard-generate.domains.general', 'Explore by label'),
    icon: 'layer-group',
    selections: selections.slice(0, MAX_INTENTS_PER_DOMAIN),
  };
}

/** Look up a curated capability intent by id (undefined if it doesn't exist). */
function capabilityIntent(id: string | undefined): DashboardIntent | undefined {
  if (!id) {
    return undefined;
  }
  return CAPABILITY_INTENTS.find((ci) => ci.intent.id === id)?.intent;
}

function intentById(list: DashboardIntent[], id: string): DashboardIntent | undefined {
  return list.find((intent) => intent.id === id);
}

/** First detected option whose label key falls into one of the given categories (in order). */
function findOption(analysis: DatasourceAnalysis, categories: LabelCategory[]): ExplorationOption | undefined {
  for (const category of categories) {
    const option = analysis.options.find((o) => categorizeLabelKey(o.labelKey) === category);
    if (option) {
      return option;
    }
  }
  return undefined;
}

/**
 * The best pivot dimension for a domain: the first matching detected option, else a
 * synthesized option from any raw label key in the category, else `fallbackKey`.
 * Synthesis keeps a domain usable even when its ideal pivot didn't win a slot in the
 * top exploration options.
 */
function pivotOption(
  analysis: DatasourceAnalysis,
  categories: LabelCategory[],
  fallbackKey: string
): ExplorationOption {
  const found = findOption(analysis, categories);
  if (found) {
    return found;
  }
  const rawKey = analysis.labelKeys.find((key) => categories.includes(categorizeLabelKey(key)));
  if (rawKey) {
    return synthesizeOption(analysis, rawKey);
  }
  // No label matches the domain's preferred categories. Prefer a real detected
  // dimension over a synthetic key so the generated template variable actually
  // resolves to values (a synthetic `instance` on, say, CloudWatch would be empty).
  return analysis.options[0] ?? synthesizeOption(analysis, fallbackKey);
}

function synthesizeOption(analysis: DatasourceAnalysis, labelKey: string): ExplorationOption {
  return {
    id: labelKey,
    labelKey,
    title: titleForLabelKey(labelKey),
    description: descriptionForLabelKey(labelKey),
    sampleValues: analysis.labelSamples[labelKey],
  };
}

/** Turns a list of (possibly undefined) intents into selections on one pivot, de-duped and capped. */
function toSelections(intents: Array<DashboardIntent | undefined>, option: ExplorationOption): IntentSelection[] {
  const out: IntentSelection[] = [];
  const seen = new Set<string>();
  for (const intent of intents) {
    if (!intent || seen.has(intent.id)) {
      continue;
    }
    seen.add(intent.id);
    out.push({ intent, option });
    if (out.length >= MAX_INTENTS_PER_DOMAIN) {
      break;
    }
  }
  return out;
}

/** Pushes one (intent, pivot) pair when both exist — used by the Kubernetes builder. */
function addSelection(
  selections: IntentSelection[],
  intent: DashboardIntent | undefined,
  option: ExplorationOption | undefined
): void {
  if (intent && option) {
    selections.push({ intent, option });
  }
}

function samplePreview(option: ExplorationOption | undefined): string | undefined {
  const values = option?.sampleValues ?? [];
  return values.length > 0 ? values.slice(0, 3).join(', ') : undefined;
}

function pushDomain(groups: DomainGroup[], group: DomainGroup): void {
  if (group.selections.length > 0) {
    groups.push(group);
  }
}

function dedupeAcrossGroups(groups: DomainGroup[]): DomainGroup[] {
  const seen = new Set<string>();
  return groups.map((group) => ({
    ...group,
    selections: group.selections.filter((selection) => {
      const key = `${selection.option.labelKey}::${selection.intent.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  }));
}
