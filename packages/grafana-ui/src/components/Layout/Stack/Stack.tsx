import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Direction, Flex } from '../Flex/Flex';
import { ResponsiveProp } from '../utils/responsiveness';

const themeTokenControl = { control: 'select', options: [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] };

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
