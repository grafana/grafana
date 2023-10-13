import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Flex } from '../Flex/Flex';
import { ResponsiveProp } from '../utils/responsiveness';
interface StackProps extends Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  direction?: ResponsiveProp<'column' | 'row'>;
  gap?: ResponsiveProp<ThemeSpacingTokens>;
}

export const Stack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<StackProps>>(
  ({ gap = 1, direction = 'column', children, ...rest }, ref) => {
    return (
      <Flex ref={ref} gap={gap} direction={direction} wrap="wrap" {...rest}>
        {React.Children.map(children, (child) => (
          <div>{child}</div>
        ))}
      </Flex>
    );
  }
);

Stack.displayName = 'Stack';
