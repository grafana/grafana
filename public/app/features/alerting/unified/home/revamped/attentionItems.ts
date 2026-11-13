import { t } from '@grafana/i18n';

import { type DeliverySummary } from './deliverySummary';
import { type GrafanaRulesSummary } from './grafanaRulesSummary';

type AttentionSeverity = 'error' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}

interface AttentionSources {
  rules?: GrafanaRulesSummary;
  delivery?: DeliverySummary;
}

/** The things on the stack someone should look at, most severe first. */
export function getAttentionItems({ rules, delivery }: AttentionSources): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (rules && rules.failingRules > 0) {
    items.push({
      id: 'failing-rules',
      severity: 'error',
      title: t('alerting.home.attention.failing-rules-title', '', {
        count: rules.failingRules,
        defaultValue_one: '{{count}} rule is failing to evaluate',
        defaultValue_other: '{{count}} rules are failing to evaluate',
      }),
      description: t(
        'alerting.home.attention.failing-rules-description',
        'Their last evaluation returned an error, so they cannot alert.'
      ),
      actionLabel: t('alerting.home.attention.failing-rules-action', 'Show rules with errors'),
      href: '/alerting/list?search=health:error',
    });
  }

  const failingChannels = delivery?.channels.filter((channel) => channel.failed > 0) ?? [];
  if (failingChannels.length > 0) {
    items.push({
      id: 'failing-channels',
      severity: 'error',
      title: t('alerting.home.attention.failing-channels-title', '', {
        count: failingChannels.length,
        defaultValue_one: '{{count}} channel failed to deliver notifications',
        defaultValue_other: '{{count}} channels failed to deliver notifications',
      }),
      description: t('alerting.home.attention.failing-channels-description', 'Most failures: {{channel}}.', {
        channel: failingChannels[0].integration,
      }),
      actionLabel: t('alerting.home.attention.failing-channels-action', 'Open contact points'),
      href: '/alerting/notifications',
    });
  }

  if (rules && rules.instances.error > 0) {
    items.push({
      id: 'error-instances',
      severity: 'error',
      title: t('alerting.home.attention.error-instances-title', '', {
        count: rules.instances.error,
        defaultValue_one: '{{count}} alert instance is in error',
        defaultValue_other: '{{count}} alert instances are in error',
      }),
      description: t(
        'alerting.home.attention.error-instances-description',
        'Their rule could not be evaluated, so they may miss real problems.'
      ),
      actionLabel: t('alerting.home.attention.error-instances-action', 'Show rules with errors'),
      href: '/alerting/list?search=health:error',
    });
  }

  if (rules && rules.instances.noData > 0) {
    items.push({
      id: 'nodata-instances',
      severity: 'warning',
      title: t('alerting.home.attention.nodata-instances-title', '', {
        count: rules.instances.noData,
        defaultValue_one: '{{count}} alert instance has no data',
        defaultValue_other: '{{count}} alert instances have no data',
      }),
      description: t(
        'alerting.home.attention.nodata-instances-description',
        'Their queries return nothing, so they cannot tell whether there is a problem.'
      ),
      actionLabel: t('alerting.home.attention.nodata-instances-action', 'Show rules with no data'),
      href: '/alerting/list?search=health:nodata',
    });
  }

  if (rules && rules.pausedRules > 0) {
    items.push({
      id: 'paused-rules',
      severity: 'warning',
      title: t('alerting.home.attention.paused-rules-title', '', {
        count: rules.pausedRules,
        defaultValue_one: '{{count}} rule is paused',
        defaultValue_other: '{{count}} rules are paused',
      }),
      description: t('alerting.home.attention.paused-rules-description', 'Paused rules do not evaluate or notify.'),
      actionLabel: t('alerting.home.attention.paused-rules-action', 'Review rules'),
      href: '/alerting/list',
    });
  }

  return items;
}
