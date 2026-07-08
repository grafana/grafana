import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';

import { type DatasourceCapabilities } from './capabilities';

/**
 * A capability chip surfaces one thing we detected on the datasource — an
 * exporter, a runtime, a cloud provider — with an icon and a short label.
 *
 * Chips are informational (not clickable). They exist so the user can glance
 * at the modal and confirm the wizard understands their stack before they
 * commit to generating.
 */
export interface CapabilityChip {
  /** Stable identifier used as a React key and telemetry dimension. */
  id: string;
  /** Short human-readable label shown on the chip (e.g. "Kubernetes", "Postgres"). */
  label: string;
  /** Grafana icon rendered in front of the label. */
  icon: IconName;
}

/**
 * Turns a {@link DatasourceCapabilities} snapshot into an ordered list of chips.
 *
 * Order matters — we surface the most differentiating signals first
 * (databases > cloud > mesh > runtimes > K8s > conventions) because that's the
 * order users find useful when eyeballing whether the wizard "got" their setup.
 *
 * We deduplicate implicitly by never emitting the same chip twice.
 */
export function buildCapabilityChips(capabilities: DatasourceCapabilities): CapabilityChip[] {
  const chips: CapabilityChip[] = [];

  for (const db of capabilities.databases) {
    chips.push({
      id: `db-${db}`,
      label: databaseLabel(db),
      icon: 'database',
    });
  }
  for (const cloud of capabilities.clouds) {
    chips.push({
      id: `cloud-${cloud}`,
      label: cloud.toUpperCase(),
      icon: 'cloud',
    });
  }
  for (const mesh of capabilities.serviceMesh) {
    chips.push({
      id: `mesh-${mesh}`,
      label: meshLabel(mesh),
      icon: 'sitemap',
    });
  }
  for (const runtime of capabilities.runtimes) {
    chips.push({
      id: `runtime-${runtime}`,
      label: runtimeLabel(runtime),
      icon: 'process',
    });
  }
  if (capabilities.kubernetes.detected) {
    chips.push({
      id: 'kubernetes',
      label: t('dashboard-generate.chips.kubernetes', 'Kubernetes'),
      icon: 'kubernetes',
    });
  }
  if (capabilities.metricConventions.includes('opentelemetry')) {
    chips.push({
      id: 'convention-otel',
      label: t('dashboard-generate.chips.opentelemetry', 'OpenTelemetry'),
      icon: 'monitor',
    });
  }

  return chips;
}

function databaseLabel(db: DatasourceCapabilities['databases'][number]): string {
  switch (db) {
    case 'postgres':
      return t('dashboard-generate.chips.db.postgres', 'Postgres');
    case 'mysql':
      return t('dashboard-generate.chips.db.mysql', 'MySQL');
    case 'redis':
      return t('dashboard-generate.chips.db.redis', 'Redis');
    case 'mongodb':
      return t('dashboard-generate.chips.db.mongodb', 'MongoDB');
    case 'kafka':
      return t('dashboard-generate.chips.db.kafka', 'Kafka');
    case 'elasticsearch':
      return t('dashboard-generate.chips.db.elasticsearch', 'Elasticsearch');
    case 'cassandra':
      return t('dashboard-generate.chips.db.cassandra', 'Cassandra');
  }
}

function meshLabel(mesh: DatasourceCapabilities['serviceMesh'][number]): string {
  switch (mesh) {
    case 'istio':
      return t('dashboard-generate.chips.mesh.istio', 'Istio');
    case 'envoy':
      return t('dashboard-generate.chips.mesh.envoy', 'Envoy');
    case 'linkerd':
      return t('dashboard-generate.chips.mesh.linkerd', 'Linkerd');
  }
}

function runtimeLabel(runtime: DatasourceCapabilities['runtimes'][number]): string {
  switch (runtime) {
    case 'go':
      return t('dashboard-generate.chips.runtime.go', 'Go');
    case 'jvm':
      return t('dashboard-generate.chips.runtime.jvm', 'JVM');
    case 'nodejs':
      return t('dashboard-generate.chips.runtime.nodejs', 'Node.js');
    case 'python':
      return t('dashboard-generate.chips.runtime.python', 'Python');
    case 'dotnet':
      return t('dashboard-generate.chips.runtime.dotnet', '.NET');
    case 'ruby':
      return t('dashboard-generate.chips.runtime.ruby', 'Ruby');
  }
}
