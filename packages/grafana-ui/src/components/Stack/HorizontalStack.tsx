import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Stack } from './Stack';

export const HorizontalStack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{ gap?: ThemeSpacingTokens }>>(
  ({ children, gap = 1 }, ref) => (
    <Stack ref={ref} direction="horizontal" gap={gap}>
      {children}
    </Stack>
  )
);
HorizontalStack.displayName = 'HorizontalStack';
