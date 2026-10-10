import { type ComponentProps } from 'react';

import { Box, useTheme2 } from '@grafana/ui';

type Props = Omit<ComponentProps<typeof Box>, 'backgroundColor' | 'borderColor' | 'borderStyle' | 'borderRadius'>;

/** Shared card surface for the alerting home page. */
export function ContentBox(props: Props) {
  const theme = useTheme2();
  return (
    <Box
      backgroundColor={theme.flags.visualDesignRefresh ? 'primary' : 'secondary'}
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      padding={2}
      flex={1}
      {...props}
    />
  );
}
