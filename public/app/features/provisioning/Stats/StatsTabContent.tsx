import { useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Card, EmptyState, Icon, Spinner, Stack, Text } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import {
  type ManagerStats,
  type ResourceCount,
  type ResourceStats,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

const FOLDER_GROUPS = ['folder.grafana.app', 'folders'];
const DASHBOARD_GROUPS = ['dashboard.grafana.app'];

interface ResourceTotals {
  folders: number;
  dashboards: number;
  other: ResourceCount[];
  total: number;
}

function emptyTotals(): ResourceTotals {
  return { folders: 0, dashboards: 0, other: [], total: 0 };
}

function addCounts(target: ResourceTotals, counts: ResourceCount[] | undefined) {
  counts?.forEach((c) => {
    target.total += c.count;
    if (FOLDER_GROUPS.includes(c.group)) {
      target.folders += c.count;
    } else if (DASHBOARD_GROUPS.includes(c.group)) {
      target.dashboards += c.count;
    } else {
      const existing = target.other.find((o) => o.group === c.group && o.resource === c.resource);
      if (existing) {
        existing.count += c.count;
      } else {
        target.other.push({ ...c });
      }
    }
  });
}

function sumCounts(counts?: ResourceCount[]) {
  return counts?.reduce((acc, c) => acc + c.count, 0) ?? 0;
}

interface BreakdownByKind {
  kind: string;
  totals: ResourceTotals;
  managers: Array<{ id: string; totals: ResourceTotals }>;
}

interface ComputedStats {
  instanceTotal: number;
  unmanagedTotal: number;
  managedTotal: number;
  gitSync: BreakdownByKind | null;
  otherProviders: BreakdownByKind[];
}

function computeStats(data?: ResourceStats): ComputedStats {
  const instanceTotal = sumCounts(data?.instance);
  const unmanagedTotal = sumCounts(data?.unmanaged);

  const byKind = new Map<string, BreakdownByKind>();
  data?.managed?.forEach((m: ManagerStats) => {
    const kind = m.kind ?? '';
    let entry = byKind.get(kind);
    if (!entry) {
      entry = { kind, totals: emptyTotals(), managers: [] };
      byKind.set(kind, entry);
    }
    const managerTotals = emptyTotals();
    addCounts(managerTotals, m.stats);
    addCounts(entry.totals, m.stats);
    entry.managers.push({ id: m.id || '', totals: managerTotals });
  });

  const gitSync = byKind.get(ManagerKind.Repo) ?? null;
  const otherProviders = Array.from(byKind.values()).filter((b) => b.kind !== ManagerKind.Repo);

  const managedTotal = Array.from(byKind.values()).reduce((acc, b) => acc + b.totals.total, 0);

  return {
    instanceTotal,
    unmanagedTotal,
    managedTotal,
    gitSync,
    otherProviders,
  };
}

function kindLabel(kind: string): string {
  switch (kind) {
    case ManagerKind.Repo:
      return t('provisioning.stats.manager-kind-repo', 'Git Sync');
    case ManagerKind.Terraform:
      return t('provisioning.stats.manager-kind-terraform', 'Terraform');
    case ManagerKind.Kubectl:
      return t('provisioning.stats.manager-kind-kubectl', 'kubectl');
    case ManagerKind.Plugin:
      return t('provisioning.stats.manager-kind-plugin', 'Plugin');
    case 'grafana':
      return t('provisioning.stats.manager-kind-grafana', 'Grafana');
    case 'classic-file-provisioning':
      return t('provisioning.stats.manager-kind-classic-fp', 'File provisioning (classic)');
    default:
      return kind || t('provisioning.stats.manager-kind-unknown', 'Unknown');
  }
}

function SummarySection({ stats }: { stats: ComputedStats }) {
  return (
    <Stack direction="row" gap={2} wrap>
      <SummaryCard label={t('provisioning.stats.summary-total', 'Total resources')} value={stats.instanceTotal} />
      <SummaryCard label={t('provisioning.stats.summary-managed', 'Managed')} value={stats.managedTotal} />
      <SummaryCard label={t('provisioning.stats.summary-unmanaged', 'Unmanaged')} value={stats.unmanagedTotal} />
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card noMargin>
      <Card.Heading>
        <Text variant="h2">{value.toLocaleString()}</Text>
      </Card.Heading>
      <Card.Description>
        <Text color="secondary">{label}</Text>
      </Card.Description>
    </Card>
  );
}

function GitSyncSection({ gitSync }: { gitSync: BreakdownByKind | null }) {
  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="code-branch" />
        <Text variant="h3">
          <Trans i18nKey="provisioning.stats.git-sync-heading">Git Sync</Trans>
        </Text>
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.stats.git-sync-description">Git Sync only supports folders and dashboards.</Trans>
      </Text>

      {!gitSync || gitSync.managers.length === 0 ? (
        <EmptyState
          variant="not-found"
          message={t('provisioning.stats.git-sync-empty', 'No resources are managed by Git Sync')}
        />
      ) : (
        <Stack direction="column" gap={2}>
          <Card noMargin>
            <Card.Heading>
              <Trans i18nKey="provisioning.stats.git-sync-totals">Totals across all repositories</Trans>
            </Card.Heading>
            <Card.Description>
              <Stack direction="row" gap={3} wrap>
                <Stat label={t('provisioning.stats.folders', 'Folders')} value={gitSync.totals.folders} />
                <Stat label={t('provisioning.stats.dashboards', 'Dashboards')} value={gitSync.totals.dashboards} />
              </Stack>
            </Card.Description>
          </Card>

          <Stack direction="column" gap={1}>
            {gitSync.managers.map((m, index) => (
              <Card noMargin key={m.id || `git-sync-${index}`}>
                <Card.Heading>
                  <Text variant="h5">{m.id || t('provisioning.stats.repository-fallback-name', 'Repository')}</Text>
                </Card.Heading>
                <Card.Description>
                  <Stack direction="row" gap={3} wrap>
                    <Stat label={t('provisioning.stats.folders', 'Folders')} value={m.totals.folders} />
                    <Stat label={t('provisioning.stats.dashboards', 'Dashboards')} value={m.totals.dashboards} />
                  </Stack>
                </Card.Description>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function OtherProvidersSection({ providers }: { providers: BreakdownByKind[] }) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="cog" />
        <Text variant="h4" color="secondary">
          <Trans i18nKey="provisioning.stats.other-providers-heading">Other providers</Trans>
        </Text>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.other-providers-description">
          Resources managed by providers other than Git Sync.
        </Trans>
      </Text>
      <Stack direction="column" gap={1}>
        {providers.map((p) => (
          <Card noMargin key={p.kind}>
            <Card.Heading>
              <Text variant="h5">{kindLabel(p.kind)}</Text>
            </Card.Heading>
            <Card.Description>
              <Stack direction="column" gap={1}>
                <Text color="secondary">
                  {t('provisioning.stats.other-provider-resource-count', '{{count}} resource', {
                    count: p.totals.total,
                  })}
                  {' • '}
                  {t('provisioning.stats.other-provider-manager-count', '{{count}} manager', {
                    count: p.managers.length,
                  })}
                </Text>
                <Stack direction="row" gap={3} wrap>
                  {p.totals.folders > 0 && (
                    <Stat label={t('provisioning.stats.folders', 'Folders')} value={p.totals.folders} />
                  )}
                  {p.totals.dashboards > 0 && (
                    <Stat label={t('provisioning.stats.dashboards', 'Dashboards')} value={p.totals.dashboards} />
                  )}
                  {p.totals.other.map((c) => (
                    <Stat key={`${c.group}/${c.resource}`} label={c.resource} value={c.count} />
                  ))}
                </Stack>
              </Stack>
            </Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="column" gap={0}>
      <Text variant="h4">{value.toLocaleString()}</Text>
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
    </Stack>
  );
}

export function StatsTabContent() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();

  const computed = useMemo(() => computeStats(data), [data]);

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner />
        <Trans i18nKey="provisioning.stats.loading">Loading stats...</Trans>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" title={t('provisioning.stats.error-title', 'Failed to load provisioning stats')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (!data || computed.instanceTotal === 0) {
    return <EmptyState variant="not-found" message={t('provisioning.stats.empty', 'No provisioned resources yet')} />;
  }

  return (
    <Stack direction="column" gap={4}>
      <SummarySection stats={computed} />
      <GitSyncSection gitSync={computed.gitSync} />
      <OtherProvidersSection providers={computed.otherProviders} />
    </Stack>
  );
}
