import { ReactNode } from 'react';

import { Box, Text } from '@grafana/ui';

interface MigrationInfoProps {
  title: NonNullable<ReactNode>;
  children: NonNullable<ReactNode>;
}

export function MigrationInfo({ title, children }: MigrationInfoProps) {
  return (
    <Box minWidth={{ xs: 0, xxl: 16 }} display="flex" direction="column">
      <Text variant="bodySmall" color="secondary">
        {title}
      </Text>
      <Text variant="h4">{children}</Text>
    </Box>
  );
}
