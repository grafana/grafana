import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Stack } from './Stack';

export const VerticalStack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{ gap: ThemeSpacingTokens }>>(
  ({ children, gap }, ref) => (
    <Stack ref={ref} direction="vertical" gap={gap}>
      {children}
    </Stack>
  )
);
VerticalStack.displayName = 'VerticalStack';
