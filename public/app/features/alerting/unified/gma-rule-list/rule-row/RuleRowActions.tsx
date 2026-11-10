import { type ReactNode } from 'react';

import { Stack } from '@grafana/ui';

import { RuleInterval } from './RuleInterval';

interface RuleRowActionsProps {
  interval?: string;
  actions?: ReactNode;
}

/** Right-column slot: evaluation interval followed by the action buttons. */
export function RuleRowActions({ interval, actions }: RuleRowActionsProps) {
  if (!interval && !actions) {
    return null;
  }
  return (
    <Stack alignItems="center" gap={1.5} wrap={false}>
      {interval && <RuleInterval interval={interval} />}
      {actions}
    </Stack>
  );
}
