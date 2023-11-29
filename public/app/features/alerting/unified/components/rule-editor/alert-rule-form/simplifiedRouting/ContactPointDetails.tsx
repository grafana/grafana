import React, { ReactNode } from 'react';

import { Icon, Stack, Text } from '@grafana/ui';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';
import { GrafanaNotifierType } from 'app/types';

import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY } from '../../../contact-points/useContactPoints';
import { ReceiverConfigWithMetadata, getReceiverDescription } from '../../../contact-points/utils';
import { ReceiverMetadataBadge } from '../../../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { ReceiverPluginMetadata } from '../../../receivers/grafanaAppReceivers/useReceiversMetadata';

interface ContactPointDetailsProps {
  receivers: ReceiverConfigWithMetadata[];
}

export const ContactPointDetails = ({ receivers }: ContactPointDetailsProps) => {
  return (
    <Stack direction="column" gap={0}>
      <div>
        {receivers.map((receiver, index) => {
          const metadata = receiver[RECEIVER_META_KEY];
          const pluginMetadata = receiver[RECEIVER_PLUGIN_META_KEY];
          const key = metadata.name + index;
          return (
            <ContactPointReceiver
              key={key}
              name={metadata.name}
              type={receiver.type}
              description={getReceiverDescription(receiver)}
              pluginMetadata={pluginMetadata}
            />
          );
        })}
      </div>
    </Stack>
  );
};

interface ContactPointReceiverProps {
  name: string;
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  pluginMetadata?: ReceiverPluginMetadata;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { name, type, description, pluginMetadata } = props;

  const iconName = INTEGRATION_ICONS[type];

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {iconName && <Icon name={iconName} />}
          {pluginMetadata ? (
            <ReceiverMetadataBadge metadata={pluginMetadata} />
          ) : (
            <Text variant="body" color="primary">
              {name}
            </Text>
          )}
        </Stack>
        {description && (
          <Text variant="bodySmall" color="secondary">
            {description}
          </Text>
        )}
      </Stack>
    </Stack>
  );
};
