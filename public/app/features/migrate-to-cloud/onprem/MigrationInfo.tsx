import React, { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

export function MigrationInfo({ title, value }: { title: NonNullable<ReactNode>; value: NonNullable<ReactNode> }) {
  return (
    <Stack direction="column">
      <Text variant="bodySmall" color="secondary">
        {title}
      </Text>
      <Text variant="h4" element="span">
        {value}
      </Text>
    </Stack>
  );
}
