import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Direction, Flex } from '../Flex/Flex';

interface StackProps {
  direction?: Direction;
  gap?: ThemeSpacingTokens;
}

export const Stack = ({ gap = 1, direction = 'column', children }: React.PropsWithChildren<StackProps>) => {
  return (
    <Flex gap={gap} direction={direction}>
      {children}
    </Flex>
  );
};
