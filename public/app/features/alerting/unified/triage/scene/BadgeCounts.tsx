import { Icon, Stack, Text } from '@grafana/ui';

export function FiringCount({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <Text color="error" tabular>
      <Stack direction="row" gap={0.25} alignItems="center">
        <Icon name="exclamation-circle" size="xs" />
        {count}
      </Stack>
    </Text>
  );
}

export function PendingCount({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <Text color="warning" tabular>
      <Stack direction="row" gap={0.25} alignItems="center">
        <Icon name="circle" size="xs" />
        {count}
      </Stack>
    </Text>
  );
}

export function LabelBadgeCounts({ firing, pending }: { firing: number; pending: number }) {
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <FiringCount count={firing} />
      <PendingCount count={pending} />
    </Stack>
  );
}
