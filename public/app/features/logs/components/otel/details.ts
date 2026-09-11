import { type IconName } from '@grafana/data';

type AttributeCategoryIcon = IconName | 'service-hexagon';

interface AttributeCategoryConfig {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: AttributeCategoryIcon;
  prefixes: string[] | undefined;
  excludedPrefixes?: string[];
}

const ATTRIBUTE_CATEGORY_CONFIG: AttributeCategoryConfig[] = [
  {
    id: 'service',
    labelKey: 'explore.span-detail.attribute-category.service',
    defaultLabel: 'Service',
    icon: 'service-hexagon',
    prefixes: ['service'],
  },
  {
    id: 'kubernetes',
    labelKey: 'explore.span-detail.attribute-category.kubernetes',
    defaultLabel: 'Kubernetes',
    icon: 'kubernetes',
    prefixes: ['k8s'],
  },
  {
    id: 'host-os',
    labelKey: 'explore.span-detail.attribute-category.host-os',
    defaultLabel: 'Host / OS',
    icon: 'layer-group',
    prefixes: ['host', 'system', 'os'],
  },
  {
    id: 'container',
    labelKey: 'explore.span-detail.attribute-category.container',
    defaultLabel: 'Container',
    icon: 'cube',
    prefixes: ['container'],
  },
  {
    id: 'cloud',
    labelKey: 'explore.span-detail.attribute-category.cloud',
    defaultLabel: 'Cloud',
    icon: 'cloud-provider',
    prefixes: ['cloud', 'aws', 'gcp', 'azure', 'google'],
  },
  {
    id: 'deployment',
    labelKey: 'explore.span-detail.attribute-category.deployment',
    defaultLabel: 'Deployment',
    icon: 'rocket',
    prefixes: ['deployment'],
  },
  {
    id: 'process',
    labelKey: 'explore.span-detail.attribute-category.process',
    defaultLabel: 'Process',
    icon: 'process',
    prefixes: ['process'],
  },
  {
    id: 'runtime',
    labelKey: 'explore.span-detail.attribute-category.runtime',
    defaultLabel: 'Runtime-specific',
    icon: 'code-branch',
    prefixes: ['jvm', 'nodejs', 'go', 'dotnet'],
    excludedPrefixes: ['google'],
  },
  {
    id: 'frontend',
    labelKey: 'explore.span-detail.attribute-category.frontend',
    defaultLabel: 'Frontend',
    icon: 'frontend-observability',
    prefixes: ['browser', 'device', 'session', 'gf.feo11y'],
  },
  {
    id: 'telemetry-sdk',
    labelKey: 'explore.span-detail.attribute-category.telemetry-sdk',
    defaultLabel: 'Telemetry SDK',
    icon: 'brackets-curly',
    prefixes: ['telemetry'],
  },
  {
    id: 'http',
    labelKey: 'explore.span-detail.attribute-category.http',
    defaultLabel: 'HTTP',
    icon: 'globe',
    prefixes: ['http'],
  },
  {
    id: 'url',
    labelKey: 'explore.span-detail.attribute-category.url',
    defaultLabel: 'URL',
    icon: 'globe',
    prefixes: ['url'],
  },
  {
    id: 'network',
    labelKey: 'explore.span-detail.attribute-category.network',
    defaultLabel: 'Network',
    icon: 'globe',
    prefixes: ['network', 'net', 'server', 'client'],
  },
  {
    id: 'database',
    labelKey: 'explore.span-detail.attribute-category.database',
    defaultLabel: 'Database',
    icon: 'database',
    prefixes: ['db'],
  },
  {
    id: 'messaging',
    labelKey: 'explore.span-detail.attribute-category.messaging',
    defaultLabel: 'Messaging',
    icon: 'envelope',
    prefixes: ['messaging'],
  },
  {
    id: 'rpc',
    labelKey: 'explore.span-detail.attribute-category.rpc',
    defaultLabel: 'RPC',
    icon: 'exchange-alt',
    prefixes: ['rpc'],
  },
  {
    id: 'error',
    labelKey: 'explore.span-detail.attribute-category.error',
    defaultLabel: 'Error',
    icon: 'exclamation-circle',
    prefixes: ['error'],
  },
  {
    id: 'exception',
    labelKey: 'explore.span-detail.attribute-category.exception',
    defaultLabel: 'Exception',
    icon: 'exclamation-triangle',
    prefixes: ['exception'],
  },
  {
    id: 'other',
    labelKey: 'explore.span-detail.attribute-category.other',
    defaultLabel: 'Other',
    icon: 'tag-alt',
    prefixes: undefined,
  },
];

const SECTION_CATEGORY_PRIORITY = [
  'frontend',
  'service',
  'deployment',
  'database',
  'process',
  'runtime',
  'container',
  'kubernetes',
  'host-os',
  'cloud',
  'telemetry-sdk',
];

export interface OTelAttributeCategory {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: AttributeCategoryIcon;
}

export interface GroupedOTelAttributes<T> {
  category: OTelAttributeCategory;
  items: T[];
}

const categoryLabelCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

function matchesPrefixes(key: string, prefixes: string[]): boolean {
  const normalized = key.toLowerCase();

  return prefixes.some((prefix) => {
    const normalizedPrefix = prefix.toLowerCase();
    return normalized.startsWith(`${normalizedPrefix}.`) || normalized.startsWith(`${normalizedPrefix}_`);
  });
}

function toPublicCategory(config: AttributeCategoryConfig): OTelAttributeCategory {
  return {
    id: config.id,
    labelKey: config.labelKey,
    defaultLabel: config.defaultLabel,
    icon: config.icon,
  };
}

function getOrderedCategories(): AttributeCategoryConfig[] {
  const other = ATTRIBUTE_CATEGORY_CONFIG.find((category) => category.id === 'other');
  const withPrefixes = ATTRIBUTE_CATEGORY_CONFIG.filter((category) => category.id !== 'other');

  const priorityCategories = SECTION_CATEGORY_PRIORITY.map((id) =>
    withPrefixes.find((category) => category.id === id)
  ).filter((category) => category !== undefined);

  const remainingCategories = withPrefixes
    .filter((category) => !SECTION_CATEGORY_PRIORITY.includes(category.id))
    .sort((a, b) => categoryLabelCollator.compare(a.defaultLabel, b.defaultLabel));

  return other
    ? [...priorityCategories, ...remainingCategories, other]
    : [...priorityCategories, ...remainingCategories];
}

function findCategory(key: string): AttributeCategoryConfig {
  for (const category of ATTRIBUTE_CATEGORY_CONFIG) {
    if (category.prefixes === undefined) {
      continue;
    }
    if (category.excludedPrefixes && matchesPrefixes(key, category.excludedPrefixes)) {
      continue;
    }
    if (matchesPrefixes(key, category.prefixes)) {
      return category;
    }
  }

  return (
    ATTRIBUTE_CATEGORY_CONFIG.find((category) => category.prefixes === undefined) ??
    ATTRIBUTE_CATEGORY_CONFIG[ATTRIBUTE_CATEGORY_CONFIG.length - 1]
  );
}

export function groupOTelAttributes<T>(items: T[], getKey: (item: T) => string): Array<GroupedOTelAttributes<T>> {
  if (!items.length) {
    return [];
  }

  const categories = getOrderedCategories();
  const grouped = new Map<string, GroupedOTelAttributes<T>>();

  for (const item of items) {
    const category = findCategory(getKey(item));
    const existingGroup = grouped.get(category.id);

    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      grouped.set(category.id, {
        category: toPublicCategory(category),
        items: [item],
      });
    }
  }

  return categories
    .map((category) => grouped.get(category.id))
    .filter((group): group is GroupedOTelAttributes<T> => group !== undefined);
}
