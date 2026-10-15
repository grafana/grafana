import { type ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

export function DeletedRuleReviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="column" gap={0.25}>
      <Text variant="bodySmall" color="secondary">
        {label}
      </Text>
      {typeof value === 'string' ? <Text>{value}</Text> : value}
    </Stack>
  );
}
