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
