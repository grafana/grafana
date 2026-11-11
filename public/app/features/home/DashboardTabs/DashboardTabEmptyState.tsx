import { type ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

interface Props {
  message: string;
  button?: ReactNode;
}

/** Centered empty state shared by the dashboard tabs. */
export function DashboardTabEmptyState({ message, button }: Props) {
  return (
    // Not EmptyState: its padding and description outgrow the card's fixed scroll area.
    <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
      <Text color="secondary" textAlignment="center">
        {message}
      </Text>
      {button}
    </Stack>
  );
}
