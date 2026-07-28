import { type IconName, type TraceKeyValuePair } from '@grafana/data';
import { t } from '@grafana/i18n';

export type AttributeSectionType = 'resource' | 'span';

export const SERVICE_CATEGORY_ID = 'service' as const;

export const SERVICE_HEXAGON_CATEGORY_ICON = 'service-hexagon' as const;

type AttributeCategoryIcon = IconName | typeof SERVICE_HEXAGON_CATEGORY_ICON;

interface AttributeCategoryDefinition {
  id: string;
  label: string;
  icon: AttributeCategoryIcon;
  match: (key: string) => boolean;
}

export interface GroupedAttributeCategory {
  category: AttributeCategoryDefinition;
  attributes: TraceKeyValuePair[];
}

interface AttributeCategoryConfig {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: AttributeCategoryIcon;
  prefixes: string[];
  excludedPrefixes?: string[];
}

const ATTRIBUTE_CATEGORY_CONFIG: AttributeCategoryConfig[] = [
  {
    id: SERVICE_CATEGORY_ID,
    labelKey: 'explore.span-detail.attribute-category.service',
    defaultLabel: 'Service',
    icon: SERVICE_HEXAGON_CATEGORY_ICON,
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
];

const SECTION_CATEGORY_PRIORITY: Record<AttributeSectionType, string[]> = {
  resource: [SERVICE_CATEGORY_ID],
  span: ['http', 'url'],
};

const categoryLabelCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

function matchesPrefixes(key: string, prefixes: string[]): boolean {
  const normalized = key.toLowerCase();

  return prefixes.some((prefix) => {
    const normalizedPrefix = prefix.toLowerCase();
    return normalized.startsWith(`${normalizedPrefix}.`) || normalized.startsWith(`${normalizedPrefix}_`);
  });
}

function createPrefixMatcher(prefixes: string[], excludedPrefixes: string[] = []): (key: string) => boolean {
  return (key: string) => {
    if (matchesPrefixes(key, excludedPrefixes)) {
      return false;
    }

    return matchesPrefixes(key, prefixes);
  };
}

function buildAttributeCategories(): AttributeCategoryDefinition[] {
  return ATTRIBUTE_CATEGORY_CONFIG.map(({ id, labelKey, defaultLabel, icon, prefixes, excludedPrefixes = [] }) => ({
    id,
    label: t(labelKey, defaultLabel),
    icon,
    match: createPrefixMatcher(prefixes, excludedPrefixes),
  }));
}

function orderAttributeCategories(
  categories: AttributeCategoryDefinition[],
  priorityCategoryIds: string[]
): AttributeCategoryDefinition[] {
  const priorityCategories = priorityCategoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is AttributeCategoryDefinition => category !== undefined);

  const remainingCategories = categories
    .filter((category) => !priorityCategoryIds.includes(category.id))
    .sort((a, b) => categoryLabelCollator.compare(a.label, b.label));

  return [...priorityCategories, ...remainingCategories];
}

export const OTHER_CATEGORY_ID = 'other' as const;

function getOtherCategory(): AttributeCategoryDefinition {
  return {
    id: OTHER_CATEGORY_ID,
    label: t('explore.span-detail.attribute-category.other', 'Other'),
    icon: 'tag-alt',
    match: () => true,
  };
}

function getAttributeCategories(sectionType: AttributeSectionType): AttributeCategoryDefinition[] {
  return orderAttributeCategories(buildAttributeCategories(), SECTION_CATEGORY_PRIORITY[sectionType]);
}

export function groupAttributesByCategory(
  attributes: TraceKeyValuePair[],
  sectionType: AttributeSectionType
): GroupedAttributeCategory[] {
  if (!attributes.length) {
    return [];
  }

  const categories = getAttributeCategories(sectionType);
  const grouped = new Map<string, GroupedAttributeCategory>();
  const unmatched: TraceKeyValuePair[] = [];

  for (const attribute of attributes) {
    const matchingCategory = categories.find((category) => category.match(attribute.key));

    if (!matchingCategory) {
      unmatched.push(attribute);
      continue;
    }

    const existingGroup = grouped.get(matchingCategory.id);

    if (existingGroup) {
      existingGroup.attributes.push(attribute);
    } else {
      grouped.set(matchingCategory.id, {
        category: matchingCategory,
        attributes: [attribute],
      });
    }
  }

  const result = categories
    .map((category) => grouped.get(category.id))
    .filter((group): group is GroupedAttributeCategory => group !== undefined);

  if (unmatched.length > 0) {
    result.push({
      category: getOtherCategory(),
      attributes: unmatched,
    });
  }

  return result;
}
