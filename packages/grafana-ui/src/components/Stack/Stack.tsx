import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Direction, Flex } from '../Flex/Flex';

interface StackProps {
  direction?: Direction;
  gap?: ThemeSpacingTokens;
}

const Stack = ({ gap, direction, children }: React.PropsWithChildren<StackProps>) => {
  return (
    <Flex gap={gap} direction="column">
      {children}
    </Flex>
  );
};

Stack.displayName = 'Stack';
export { Stack };
