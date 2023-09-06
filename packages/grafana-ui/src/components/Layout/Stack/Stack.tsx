import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Direction, Flex } from '../Flex/Flex';
import { ResponsiveProp } from '../ResponsiveTypes';

interface StackProps {
  direction?: ResponsiveProp<Direction>;
  gap?: ResponsiveProp<ThemeSpacingTokens>;
}

export const Stack = ({ gap = 1, direction = 'column', children }: React.PropsWithChildren<StackProps>) => {
  return (
    <Flex gap={gap} direction={direction}>
      {children}
    </Flex>
  );
};
