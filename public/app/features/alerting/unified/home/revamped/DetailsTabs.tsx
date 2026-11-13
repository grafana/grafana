import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Tab, TabContent, TabsBar, Text, TextLink, useStyles2 } from '@grafana/ui';

import { isNotificationHistoryEnabled } from '../../featureToggles';
import { createRelativeUrl } from '../../utils/url';

import { DeliveryByChannel } from './DeliveryByChannel';
import { DeliveryOverTimeChart, UsageChart } from './DetailsCharts';
import { MissedEvaluationsTable } from './MissedEvaluationsTable';
import { type DeliverySummary } from './deliverySummary';
import { toSceneRange } from './homeRange';
import { BOX_GAP } from './layout';

type DetailsTab = 'evaluation' | 'notifications';

interface DetailsTabsProps {
  /** Grafana Cloud usage metrics are readable by this user, so the history charts can be shown. */
  usageMetricsAvailable: boolean;
  delivery?: DeliverySummary;
  range: TimeRange;
}

/**
 * Detail charts below the overview. They reuse the Insights panels, so they need Grafana Cloud's
 * usage metrics; delivery by channel needs notification history instead.
 */
export function DetailsTabs({ usageMetricsAvailable, delivery, range }: DetailsTabsProps) {
  const styles = useStyles2(getStyles);
  const tabs = useMemo(() => {
    const available: DetailsTab[] = [];
    if (usageMetricsAvailable) {
      available.push('evaluation');
    }
    if (usageMetricsAvailable || delivery) {
      available.push('notifications');
    }
    return available;
  }, [usageMetricsAvailable, delivery]);

  const [selected, setSelected] = useState<DetailsTab | undefined>(undefined);
  const active = selected && tabs.includes(selected) ? selected : tabs[0];

  if (!active) {
    return null;
  }

  return (
    <div>
      <TabsBar>
        {tabs.includes('evaluation') && (
          <Tab
            label={t('alerting.home.details.rule-evaluation', 'Rule evaluation')}
            active={active === 'evaluation'}
            onChangeTab={() => setSelected('evaluation')}
          />
        )}
        {tabs.includes('notifications') && (
          <Tab
            label={t('alerting.home.details.alert-notifications', 'Alert notifications')}
            active={active === 'notifications'}
            onChangeTab={() => setSelected('notifications')}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        <Stack direction="column" gap={BOX_GAP}>
          {active === 'evaluation' && (
            <div className={styles.grid}>
              <UsageChart kind="instances" range={range} />
              <UsageChart kind="rules-evaluating" range={range} />
              <UsageChart kind="evaluation-success" range={range} />
              <UsageChart kind="missed" range={range} />
              <div className={styles.wide}>
                <MissedEvaluationsTable range={range} />
              </div>
            </div>
          )}
          {active === 'notifications' && (
            <>
              {isNotificationHistoryEnabled() && <NotificationHistoryCallout range={range} />}
              <div className={styles.grid}>
                {usageMetricsAvailable && <UsageChart kind="alertmanager-alerts" range={range} />}
                {usageMetricsAvailable && <UsageChart kind="silences" range={range} />}
                {delivery?.overTime && <DeliveryOverTimeChart overTime={delivery.overTime} range={range} />}
                {delivery && (
                  <div className={styles.wide}>
                    <DeliveryByChannel delivery={delivery} range={range} />
                  </div>
                )}
              </div>
            </>
          )}
        </Stack>
      </TabContent>
    </div>
  );
}

/** Notification history answers what this tab only summarizes, so the tab points there first. */
function NotificationHistoryCallout({ range }: { range: TimeRange }) {
  const styles = useStyles2(getStyles);
  // The history page reads its range from the URL, so it opens on the same window as this page.
  const href = createRelativeUrl('/alerting/history', { tab: 'notifications', ...toSceneRange(range) });

  return (
    <section
      className={styles.callout}
      aria-label={t('alerting.home.notification-history.title', 'Notification history')}
    >
      <Text color="secondary">
        <Trans i18nKey="alerting.home.notification-history.body">
          The best place to learn about your notifications: every notification sent, the alerts it carried, where it
          went and whether it was delivered.
        </Trans>{' '}
        <TextLink href={href} inline>
          {t('alerting.home.notification-history.open', 'Open notification history')}
        </TextLink>
      </Text>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The tab bar has no space under it, so the first box would touch the tab line.
  tabContent: css({ paddingTop: theme.spacing(BOX_GAP) }),
  // The same three columns as the tiles above, so the charts line up with them.
  grid: css({
    display: 'grid',
    gap: theme.spacing(BOX_GAP),
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  }),
  wide: css({
    gridColumn: 'span 2',
    minWidth: 0,
    [theme.breakpoints.down('lg')]: { gridColumn: 'auto' },
  }),
  callout: css({
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
