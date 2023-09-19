import React from 'react';

import { ThemeSpacingTokens } from '@grafana/data';

import { Flex } from '../Flex/Flex';

interface StackProps {
  direction?: 'horizontal' | 'vertical';
  gap?: ThemeSpacingTokens;
}

export const Stack = ({ gap = 1, direction = 'vertical', children }: React.PropsWithChildren<StackProps>) => {
  return (
    <Flex gap={gap} direction={direction === 'vertical' ? 'column' : 'row'} wrap="wrap">
      {React.Children.map(children, (child) => (
        <div>{child}</div>
      ))}
    </Flex>
  );
};
