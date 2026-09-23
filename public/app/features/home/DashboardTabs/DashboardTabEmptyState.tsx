import { type ComponentProps, type ReactNode } from 'react';

import { EmptyState, Stack, Text } from '@grafana/ui';

interface Props {
  message: string;
  variant: ComponentProps<typeof EmptyState>['variant'];
  /** Description shown under the message; dropped in the compact density. */
  children: ReactNode;
  button?: ReactNode;
  density?: 'default' | 'compact';
}

/** Centered empty state shared by the dashboard tabs. */
export function DashboardTabEmptyState({ message, variant, children, button, density }: Props) {
  return (
    <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
      {density === 'compact' ? (
        // The full EmptyState (padding + description) outgrows the redesign card's fixed scroll area.
        <>
          <Text color="secondary" textAlignment="center">
            {message}
          </Text>
          {button}
        </>
      ) : (
        <EmptyState hideImage variant={variant} message={message} button={button}>
          {children}
        </EmptyState>
      )}
    </Stack>
  );
}
