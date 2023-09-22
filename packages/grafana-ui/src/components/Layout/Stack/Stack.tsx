import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Flex } from '../Flex/Flex';

import { HorizontalStack } from './HorizontalStack';

interface StackProps {
  direction?: 'horizontal' | 'vertical';
  gap?: ThemeSpacingTokens;
}

export const Stack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<StackProps>>(
  ({ gap = 1, direction = 'vertical', children }, ref) => {
    return (
      <Flex ref={ref} gap={gap} direction={direction === 'vertical' ? 'column' : 'row'} wrap="wrap">
        {React.Children.map(children, (child) => (
          <div>{child}</div>
        ))}
      </Flex>
    );
  }
);

Stack.displayName = 'Stack';

export { HorizontalStack };
