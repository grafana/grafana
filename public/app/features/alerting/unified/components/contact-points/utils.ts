import { split } from 'lodash';
import { ReactNode } from 'react';

import {
  AlertManagerCortexConfig,
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
} from 'app/plugins/datasource/alertmanager/types';
import { NotifierStatus, ReceiversStateDTO } from 'app/types';

import { extractReceivers } from '../../utils/receivers';

import { RECEIVER_STATUS_KEY } from './useContactPoints';

export function isProvisioned(contactPoint: GrafanaManagedContactPoint) {
  // for some reason the provenance is on the receiver and not the entire contact point
  const provenance = contactPoint.grafana_managed_receiver_configs?.find((receiver) => receiver.provenance)?.provenance;

  return Boolean(provenance);
}

// TODO we should really add some type information to these receiver settings...
export function getReceiverDescription(receiver: GrafanaManagedReceiverConfig): ReactNode | undefined {
  switch (receiver.type) {
    case 'email': {
      const hasEmailAddresses = 'addresses' in receiver.settings; // when dealing with alertmanager email_configs we don't normalize the settings
      return hasEmailAddresses ? summarizeEmailAddresses(receiver.settings['addresses']) : undefined;
    }
    case 'slack': {
      const channelName = receiver.settings['recipient'];
      return channelName ? `#${channelName}` : undefined;
    }
    case 'kafka': {
      const topicName = receiver.settings['kafkaTopic'];
      return topicName;
    }
    default:
      return undefined;
  }
}

// input: foo+1@bar.com, foo+2@bar.com, foo+3@bar.com, foo+4@bar.com
// output: foo+1@bar.com, foo+2@bar.com, +2 more
function summarizeEmailAddresses(addresses: string): string {
  const MAX_ADDRESSES_SHOWN = 3;
  const SUPPORTED_SEPARATORS = /,|;|\\n/;

  const emails = addresses.trim().split(SUPPORTED_SEPARATORS);
  const notShown = emails.length - MAX_ADDRESSES_SHOWN;

  const truncatedAddresses = split(addresses, SUPPORTED_SEPARATORS, MAX_ADDRESSES_SHOWN);
  if (notShown > 0) {
    truncatedAddresses.push(`+${notShown} more`);
  }

  return truncatedAddresses.join(', ');
}

// Grafana Managed contact points have receivers with additional diagnostics
export interface ReceiverConfigWithStatus extends GrafanaManagedReceiverConfig {
  // we're using a symbol here so we'll never have a conflict on keys for a receiver
  // we also specify that the diagnostics might be "undefined" for vanilla Alertmanager
  [RECEIVER_STATUS_KEY]?: NotifierStatus | undefined;
}

export interface ContactPointWithStatus extends GrafanaManagedContactPoint {
  grafana_managed_receiver_configs: ReceiverConfigWithStatus[];
}

/**
 * This function adds the status information for each of the integrations (contact point types) in a contact point
 * 1. we iterate over all contact points
 * 2. for each contact point we "enhance" it with the status or "undefined" for vanilla Alertmanager
 */
export function enhanceContactPointsWithStatus(
  result: AlertManagerCortexConfig,
  status: ReceiversStateDTO[] = []
): ContactPointWithStatus[] {
  const contactPoints = result.alertmanager_config.receivers ?? [];

  return contactPoints.map((contactPoint) => {
    const receivers = extractReceivers(contactPoint);
    const statusForReceiver = status.find((status) => status.name === contactPoint.name);

    return {
      ...contactPoint,
      grafana_managed_receiver_configs: receivers.map((receiver, index) => ({
        ...receiver,
        [RECEIVER_STATUS_KEY]: statusForReceiver?.integrations[index],
      })),
    };
  });
}
