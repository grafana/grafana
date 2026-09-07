import { type ComponentProps } from 'react';

import { Box } from '@grafana/ui';

type Props = Omit<ComponentProps<typeof Box>, 'backgroundColor' | 'borderColor' | 'borderStyle' | 'borderRadius'>;

/** Shared card surface for the alerting home page. */
export function ContentBox(props: Props) {
  return (
    <Box
      backgroundColor="secondary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      padding={2}
      {...props}
    />
  );
}
