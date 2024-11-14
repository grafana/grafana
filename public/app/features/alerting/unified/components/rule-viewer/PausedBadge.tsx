import { Icon, Stack, Text } from '@grafana/ui';

export default function PausedBadge() {
  return (
    <Text variant="bodySmall" color="warning">
      <Stack direction="row" alignItems={'center'} gap={0.25} wrap={'nowrap'} flex={'0 0 auto'}>
        <Icon name="pause" size="xs" /> Paused
      </Stack>
    </Text>
  );
}
