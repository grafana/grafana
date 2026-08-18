import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { type PromoteStatsSummary } from './types';

/**
 * Summary of how many resources a promote will merge into the live config, shown on the
 * review screen and the settings promote-confirmation modal. Lists only the resource types
 * that are actually present in the import.
 */
export function PromoteMergeSummary({ stats }: { stats: PromoteStatsSummary }) {
  const items: string[] = [];

  if (stats.receivers > 0) {
    items.push(
      t('alerting.import-to-gma.review.merge-receivers', '', {
        count: stats.receivers,
        defaultValue_one: '{{count}} contact point',
        defaultValue_other: '{{count}} contact points',
      })
    );
  }
  if (stats.templates > 0) {
    items.push(
      t('alerting.import-to-gma.review.merge-templates', '', {
        count: stats.templates,
        defaultValue_one: '{{count}} template',
        defaultValue_other: '{{count}} templates',
      })
    );
  }
  if (stats.timeIntervals > 0) {
    items.push(
      t('alerting.import-to-gma.review.merge-time-intervals', '', {
        count: stats.timeIntervals,
        defaultValue_one: '{{count}} mute timing',
        defaultValue_other: '{{count}} mute timings',
      })
    );
  }
  if (stats.inhibitionRules > 0) {
    items.push(
      t('alerting.import-to-gma.review.merge-inhibition-rules', '', {
        count: stats.inhibitionRules,
        defaultValue_one: '{{count}} inhibition rule',
        defaultValue_other: '{{count}} inhibition rules',
      })
    );
  }
  if (stats.route) {
    items.push(t('alerting.import-to-gma.review.merge-route', 'a notification route'));
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t('alerting.import-to-gma.review.merge-summary', 'Will merge into your live config: {{summary}}', {
        summary: items.join(', '),
      })}
    />
  );
}
