import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';
import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { SummaryCard, SummaryCardMeta, SummaryCardTitle } from './SummaryCard';
import { HOME_CARD_MAX_ITEMS } from './constants';

export function OnCallCard() {
  const { pluginId, installed, loading, settings } = useIrmPlugin(SupportedPlugin.OnCall);

  // Hide the card whenever the OnCall/IRM plugin isn't available — including while the
  // settings probe is in flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  // Gate schedule links like IncidentsCard does: a user without access to the plugin's schedules
  // page sees names as plain text, not links that 403 on click.
  const canAccess = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/schedules')) : false;

  return <OnCallCardInner pluginId={pluginId} canAccess={canAccess} />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function OnCallCardInner({ pluginId, canAccess }: { pluginId: string; canAccess: boolean }) {
  const { data: schedules = [], isLoading, error, refetch } = onCallApi.useGetOnCallSchedulesQuery({ pluginId });

  // Flatten to one row per (schedule, on-call user). on_call_now carries no shift end time, so no age column.
  const rows = useMemo(
    () =>
      schedules.flatMap((s) =>
        s.on_call_now.map((u) => ({ key: `${s.id}:${u.pk}`, user: u.username, schedule: s.name }))
      ),
    [schedules]
  );
  const displayed = rows.slice(0, HOME_CARD_MAX_ITEMS);

  return (
    <SummaryCard
      title={t('home.oncall-card.title', 'On call now')}
      count={rows.length}
      countColor="blue"
      countLimit={HOME_CARD_MAX_ITEMS}
      loading={isLoading}
      error={
        error
          ? { title: t('home.oncall-card.error-title', 'Could not load on-call schedules'), onRetry: () => refetch() }
          : undefined
      }
      emptyMessage={t('home.oncall-card.empty', 'No one is on call right now.')}
      items={displayed}
      getItemKey={(r) => r.key}
      renderItem={(r) => (
        <>
          <SummaryCardTitle href={canAccess ? createBridgeURL(pluginId, '/schedules') : undefined}>
            {r.user}
          </SummaryCardTitle>
          <SummaryCardMeta>{r.schedule}</SummaryCardMeta>
        </>
      )}
      footer={
        canAccess && (
          <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(pluginId, '/schedules')}>
            {t('home.oncall-card.view-schedules', 'View schedules')}
          </LinkButton>
        )
      }
    />
  );
}
