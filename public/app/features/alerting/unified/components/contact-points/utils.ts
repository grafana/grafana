import { split } from 'lodash';
import { ReactNode } from 'react';

import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';

export function isProvisioned(contactPoint: Receiver) {
  // for some reason the provenance is on the receiver and not the entire contact point
  const provenance = contactPoint.grafana_managed_receiver_configs?.find((receiver) => receiver.provenance)?.provenance;

  return Boolean(provenance);
}

// TODO we should really add some type information to these receiver settings...
export function getReceiverDescription(receiver: GrafanaManagedReceiverConfig): ReactNode | undefined {
  switch (receiver.type) {
    case 'email': {
      return summarizeEmailAddresses(receiver.settings['addresses']);
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

  const emails = addresses.split(SUPPORTED_SEPARATORS);
  const notShown = emails.length - MAX_ADDRESSES_SHOWN;

  const truncatedAddresses = split(addresses, SUPPORTED_SEPARATORS, MAX_ADDRESSES_SHOWN);
  if (notShown > 0) {
    truncatedAddresses.push(`+${notShown} more`);
  }

  return truncatedAddresses.join(', ');
}
