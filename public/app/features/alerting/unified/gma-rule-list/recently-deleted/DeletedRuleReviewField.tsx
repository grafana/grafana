import { type ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

/** A labeled row in the human-readable preview; text values get the default text style, anything else renders as given. */
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
