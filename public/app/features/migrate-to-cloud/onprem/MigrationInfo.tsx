import React, { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

interface MigrationInfoProps {
  title: NonNullable<ReactNode>;
  value: NonNullable<ReactNode>;
}

export function MigrationInfo({ title, value }: MigrationInfoProps) {
  return (
    <Stack direction="column">
      <Text variant="bodySmall" color="secondary">
        {title}
      </Text>
      <Text variant="h4">{value}</Text>
    </Stack>
  );
}
