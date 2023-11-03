import { css } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { ResponsiveProp, getResponsiveStyle } from '../utils/responsiveness';

export type AlignItems =
  | 'stretch'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'start'
  | 'end'
  | 'self-start'
  | 'self-end';

export type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'start'
  | 'end'
  | 'left'
  | 'right';

export type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';

export type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse';

interface StackProps extends Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  gap?: ResponsiveProp<ThemeSpacingTokens>;
  alignItems?: ResponsiveProp<AlignItems>;
  justifyContent?: ResponsiveProp<JustifyContent>;
  direction?: ResponsiveProp<Direction>;
  wrap?: ResponsiveProp<Wrap>;
  children?: React.ReactNode;
  flexGrow?: ResponsiveProp<CSSProperties['flexGrow']>;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ gap = 1, alignItems, justifyContent, direction, wrap, children, flexGrow, ...rest }, ref) => {
    const styles = useStyles2(getStyles, gap, alignItems, justifyContent, direction, wrap, flexGrow);

    // Extract 'invalid' prop, which is implicitly passed to children by the Field component, to avoid React warning
    // @ts-expect-error
    const { invalid, ...divProps } = rest;
    return (
      <div ref={ref} className={styles.flex} {...divProps}>
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';

const getStyles = (
  theme: GrafanaTheme2,
  gap: StackProps['gap'],
  alignItems: StackProps['alignItems'],
  justifyContent: StackProps['justifyContent'],
  direction: StackProps['direction'],
  wrap: StackProps['wrap'],
  flexGrow: StackProps['flexGrow']
) => {
  return {
    flex: css([
      {
        display: 'flex',
      },
      getResponsiveStyle(theme, direction, (val) => ({
        flexDirection: val,
      })),
      getResponsiveStyle(theme, wrap, (val) => ({
        flexWrap: val,
      })),
      getResponsiveStyle(theme, alignItems, (val) => ({
        alignItems: val,
      })),
      getResponsiveStyle(theme, justifyContent, (val) => ({
        justifyContent: val,
      })),
      getResponsiveStyle(theme, gap, (val) => ({
        gap: theme.spacing(val),
      })),
      getResponsiveStyle(theme, flexGrow, (val) => ({
        flexGrow: val,
      })),
    ]),
  };
};
