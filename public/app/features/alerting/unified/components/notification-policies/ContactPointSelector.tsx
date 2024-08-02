import { SelectableValue } from '@grafana/data';
import { Select, SelectCommonProps, Text, Stack } from '@grafana/ui';

import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY } from '../contact-points/constants';
import { useContactPointsWithStatus } from '../contact-points/useContactPoints';
import { ReceiverConfigWithMetadata } from '../contact-points/utils';

export const ContactPointSelector = (props: SelectCommonProps<string>) => {
  const { contactPoints, isLoading, error } = useContactPointsWithStatus();

  // TODO error handling
  if (error) {
    return <span>Failed to load contact points</span>;
  }

  const options: Array<SelectableValue<string>> = contactPoints.map((contactPoint) => {
    return {
      label: contactPoint.name,
      value: contactPoint.name,
      component: () => <ReceiversSummary receivers={contactPoint.grafana_managed_receiver_configs} />,
    };
  });

  return <Select options={options} isLoading={isLoading} {...props} />;
};

interface ReceiversProps {
  receivers: ReceiverConfigWithMetadata[];
}

const ReceiversSummary = ({ receivers }: ReceiversProps) => {
  return (
    <Stack direction="row">
      {receivers.map((receiver, index) => (
        <Stack key={receiver.uid ?? index} direction="row" gap={0.5}>
          {receiver[RECEIVER_PLUGIN_META_KEY]?.icon && (
            <img
              width="16px"
              src={receiver[RECEIVER_PLUGIN_META_KEY]?.icon}
              alt={receiver[RECEIVER_PLUGIN_META_KEY]?.title}
            />
          )}
          <Text key={index} variant="bodySmall" color="secondary">
            {receiver[RECEIVER_META_KEY].name ?? receiver[RECEIVER_PLUGIN_META_KEY]?.title ?? receiver.type}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
};
