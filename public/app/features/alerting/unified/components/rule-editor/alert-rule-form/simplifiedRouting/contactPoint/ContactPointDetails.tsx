import { Stack } from '@grafana/ui';

import { ContactPointReceiverTitleRow } from '../../../../contact-points/ContactPoint';
import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY } from '../../../../contact-points/constants';
import { ReceiverConfigWithMetadata, getReceiverDescription } from '../../../../contact-points/utils';

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
            <ContactPointReceiverTitleRow
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
