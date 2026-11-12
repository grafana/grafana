import { useMemo, useState } from 'react';

import { type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Tab, TabContent, TabsBar } from '@grafana/ui';

import { DeliveryByChannel } from './DeliveryByChannel';
import { NotificationCharts, RuleEvaluationCharts } from './DetailsCharts';
import { type DeliverySummary } from './deliverySummary';

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
      <TabContent>
        <Stack direction="column" gap={2}>
          {active === 'evaluation' && <RuleEvaluationCharts range={range} />}
          {active === 'notifications' && (
            <>
              {usageMetricsAvailable && <NotificationCharts range={range} />}
              {delivery && <DeliveryByChannel delivery={delivery} range={range} />}
            </>
          )}
        </Stack>
      </TabContent>
    </div>
  );
}
