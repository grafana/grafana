import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { ResponsiveProp } from '../utils/responsiveness';

import { Stack } from './Stack';

export const HorizontalStack = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<{ gap?: ResponsiveProp<ThemeSpacingTokens> }>
>(({ children, gap = 1 }, ref) => (
  <Stack ref={ref} direction="row" gap={gap}>
    {children}
  </Stack>
));
HorizontalStack.displayName = 'HorizontalStack';
