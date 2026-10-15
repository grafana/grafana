import { type ReactNode } from 'react';

import { Icon, type IconName, Stack, Text } from '@grafana/ui';

interface MetaItemProps {
  icon?: IconName;
  children: NonNullable<ReactNode>;
}

export function MetaItem({ icon, children }: MetaItemProps) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {icon && <Icon name={icon} size="xs" />}
      <Text variant="bodySmall" color="secondary">
        {children}
      </Text>
    </Stack>
  );
}
