import React from 'react';

import { Flex, FlexProps } from '../Flex/Flex';

interface StackProps extends Pick<FlexProps, 'gap' | 'direction' | 'alignItems' | 'justifyContent'> {}

export const Stack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<StackProps>>(
  ({ gap = 1, alignItems, justifyContent, direction = 'column', children, ...rest }, ref) => {
    return (
      <Flex
        ref={ref}
        gap={gap}
        direction={direction}
        alignItems={alignItems}
        justifyContent={justifyContent}
        wrap="wrap"
        {...rest}
      >
        {React.Children.toArray(children)
          .filter(Boolean)
          .map((child, index) => (
            <div key={index}>{child}</div>
          ))}
      </Flex>
    );
  }
);

Stack.displayName = 'Stack';
