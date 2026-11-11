import { type ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

interface Props {
  icon: ReactNode;
  action?: ReactNode;
  children: NonNullable<ReactNode>;
}

export function InlineNotice({ icon, action, children }: Props) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {icon}
      <Text variant="bodySmall" color="secondary">
        {children}
      </Text>
      {action}
    </Stack>
  );
}
