import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, LinkButton, Stack, Text } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HomeDataCard } from './HomeDataCard';
import { InsightRow } from './overviewShared';

interface SloStatus {
  availabilityPercent?: number;
  errorBudgetRemainingPercent?: number;
  burning?: boolean;
}

interface SloEntry {
  status?: SloStatus;
}

export interface SlosOverview {
  availability: number;
  errorBudgetPct: number;
  atRisk: number;
  total: number;
}

/**
 * Resolve worst-case availability / error-budget and the at-risk count across the org's SLOs from the
 * grafana-slo-app plugin's resource API.
 *
 * UNVERIFIED — confirm against a live grafana-slo-app: the plugin is not installed in this env, so the
 * resource path `/api/plugins/grafana-slo-app/resources/v1/slo` and the
 * `status.{availabilityPercent,errorBudgetRemainingPercent,burning}` fields are best-known shapes. On a
 * live instance, confirm the path and remap only the three derived numbers — the card UI stays the same.
 */
export async function fetchSlos(): Promise<SlosOverview> {
  const res = await getBackendSrv().get<{ slos?: SloEntry[]; data?: SloEntry[] }>(
    '/api/plugins/grafana-slo-app/resources/v1/slo'
  );
  const slos = res?.slos ?? res?.data ?? [];
  const statuses = slos.map((s) => s.status).filter((s): s is SloStatus => s != null);
  const availability = statuses.length ? Math.min(...statuses.map((s) => s.availabilityPercent ?? 100)) : 100;
  const errorBudgetPct = statuses.length ? Math.min(...statuses.map((s) => s.errorBudgetRemainingPercent ?? 100)) : 100;
  const atRisk = statuses.filter((s) => s.burning).length;
  return { availability, errorBudgetPct, atRisk, total: slos.length };
}

export function SlosCard() {
  const { value, loading, error, retry } = useAsyncRetry(fetchSlos, []);

  const statusPill = !value ? undefined : value.atRisk === 0 ? (
    <Badge color="green" text={t('home.slos-card.healthy', 'Healthy')} />
  ) : (
    <Badge
      color="orange"
      text={t('home.slos-card.at-risk-badge', '', {
        count: value.atRisk,
        defaultValue_one: '{{count}} at risk',
        defaultValue_other: '{{count}} at risk',
      })}
    />
  );

  return (
    <HomeDataCard
      title={t('home.slos-card.title', 'SLOs')}
      headerActions={statusPill}
      loading={loading}
      loadingContent={<Skeleton height={96} />}
      error={error ? { title: t('home.slos-card.error-title', 'Could not load SLOs'), onRetry: retry } : undefined}
      isEmpty={!!value && value.total === 0}
      emptyMessage={t('home.slos-card.empty', 'No SLOs defined.')}
      footer={
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          href={createBridgeURL(SupportedPlugin.Slo, '/manage-slos')}
        >
          <Trans i18nKey="home.slos-card.open">Open SLOs</Trans>
        </LinkButton>
      }
    >
      {value && (
        <Stack direction="column" gap={2} grow={1}>
          <Stack direction="column" gap={0}>
            <Text variant="h2">{`${value.availability.toFixed(2)}%`}</Text>
            <Text color="secondary">{t('home.slos-card.window', '30-day availability')}</Text>
          </Stack>

          <Stack direction="column" gap={0}>
            <InsightRow severity={value.errorBudgetPct > 0 ? 'success' : 'error'}>
              {t('home.slos-card.budget', 'Error budget {{pct}}% remaining', { pct: value.errorBudgetPct.toFixed(0) })}
            </InsightRow>
            <InsightRow severity={value.atRisk === 0 ? 'success' : 'warning'}>
              {value.atRisk === 0
                ? t('home.slos-card.all-ok', 'All SLOs healthy')
                : t('home.slos-card.at-risk-row', '{{atRisk}} of {{total}} SLOs at risk', {
                    atRisk: value.atRisk,
                    total: value.total,
                  })}
            </InsightRow>
          </Stack>
        </Stack>
      )}
    </HomeDataCard>
  );
}
