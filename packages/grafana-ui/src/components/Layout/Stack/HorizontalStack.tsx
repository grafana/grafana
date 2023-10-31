import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { ResponsiveProp } from '../utils/responsiveness';

import { Stack } from './Stack';

interface HorizontalStackProps extends Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  gap?: ResponsiveProp<ThemeSpacingTokens>;
}

export const HorizontalStack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<HorizontalStackProps>>(
  ({ children, gap = 1, ...rest }, ref) => (
    <Stack ref={ref} direction="row" gap={gap} {...rest}>
      {children}
    </Stack>
  )
);
HorizontalStack.displayName = 'HorizontalStack';
