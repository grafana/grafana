import { type IconName } from '@grafana/data';
import { Box, Icon, Text } from '@grafana/ui';

type Props = { iconName: IconName; label: string };

export const CategoryHeader = ({ iconName, label }: Props) => {
  return (
    <Box gap={1} display="flex" alignItems="center" marginBottom={3}>
      <Icon name={iconName} size="xl" />
      <Text element="h2" variant="h3">
        {label}
      </Text>
    </Box>
  );
};
