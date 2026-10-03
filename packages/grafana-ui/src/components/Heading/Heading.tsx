import { createContext, useContext, type HTMLAttributes, type PropsWithChildren } from 'react';

import { Text, type TextProps } from '../Text/Text';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type HeadingElementProps = HTMLAttributes<HTMLElement>;

export type HeadingProps = Omit<TextProps, 'element' | 'truncate' | 'variant'> & {
  variant: NonNullable<TextProps['variant']>;
};

export type HeadingRootProps = PropsWithChildren<{
  level?: HeadingLevel;
}>;

export type HeadingSectionProps = PropsWithChildren;

const HeadingLevelContext = createContext<number>(1);
const headingElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

export const HeadingRoot = ({ level = 1, children }: HeadingRootProps) => {
  return <HeadingLevelContext.Provider value={level}>{children}</HeadingLevelContext.Provider>;
};

export const HeadingSection = ({ children }: HeadingSectionProps) => {
  const level = useContext(HeadingLevelContext);

  return <HeadingLevelContext.Provider value={level + 1}>{children}</HeadingLevelContext.Provider>;
};

export const HeadingElement = (props: HeadingElementProps) => {
  const level = useContext(HeadingLevelContext);
  const Element = headingElements[level - 1] ?? 'div';

  return <Element {...props} role={level > 6 ? 'heading' : undefined} aria-level={level > 6 ? level : undefined} />;
};

export const Heading = ({ variant, ...props }: HeadingProps) => {
  return <Text {...props} element={HeadingElement} variant={variant} />;
};

Heading.displayName = 'Heading';
HeadingElement.displayName = 'HeadingElement';
HeadingRoot.displayName = 'HeadingRoot';
HeadingSection.displayName = 'HeadingSection';
