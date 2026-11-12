import { type CreateNotificationqueryNotificationCount } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';

export interface ChannelDelivery {
  integration: string;
  attempts: number;
  failed: number;
}

export interface DeliverySummary {
  attempts: number;
  failed: number;
  /** Sorted by failures, then by attempts, so channels with problems come first. */
  channels: ChannelDelivery[];
}

/**
 * Folds notification history counts grouped by integration and outcome into per-channel totals.
 * Counts are notification attempts, retries included.
 */
export function summarizeDelivery(counts: CreateNotificationqueryNotificationCount[]): DeliverySummary {
  const byIntegration = new Map<string, ChannelDelivery>();

  for (const { integration = 'unknown', outcome, count } of counts) {
    const channel = byIntegration.get(integration) ?? { integration, attempts: 0, failed: 0 };
    channel.attempts += count;
    if (outcome === 'error') {
      channel.failed += count;
    }
    byIntegration.set(integration, channel);
  }

  const channels = [...byIntegration.values()].sort((a, b) => b.failed - a.failed || b.attempts - a.attempts);

  return {
    attempts: channels.reduce((sum, channel) => sum + channel.attempts, 0),
    failed: channels.reduce((sum, channel) => sum + channel.failed, 0),
    channels,
  };
}
