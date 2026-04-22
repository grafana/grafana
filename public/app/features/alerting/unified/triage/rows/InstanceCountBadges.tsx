import { type ReactNode } from 'react';

import { Stack } from '@grafana/ui';

import { FiringCount, PendingCount } from '../scene/BadgeCounts';
import { type InstanceCounts } from '../types';

interface RowActionsProps {
  counts: InstanceCounts;
  actionButton?: ReactNode;
}

export function RowActions({ counts, actionButton }: RowActionsProps) {
  const { firing, pending } = counts;

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Stack direction="row" gap={0.5} alignItems="center">
        {pending > 0 && <PendingCount count={pending} />}
        {firing > 0 && <FiringCount count={firing} />}
      </Stack>
      {actionButton}
    </Stack>
  );
}
