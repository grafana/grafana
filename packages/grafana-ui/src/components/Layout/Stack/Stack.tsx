import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { AlignItems, Direction, FlexProps, JustifyContent, Wrap } from '../types';
import { ResponsiveProp, getResponsiveStyle } from '../utils/responsiveness';

interface StackProps extends FlexProps, Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  gap?: ResponsiveProp<ThemeSpacingTokens>;
  alignItems?: ResponsiveProp<AlignItems>;
  justifyContent?: ResponsiveProp<JustifyContent>;
  direction?: ResponsiveProp<Direction>;
  wrap?: ResponsiveProp<Wrap>;
  children?: React.ReactNode;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>((props, ref) => {
  const { gap = 1, alignItems, justifyContent, direction, wrap, children, grow, shrink, basis, flex, ...rest } = props;
  const styles = useStyles2(getStyles, gap, alignItems, justifyContent, direction, wrap, grow, shrink, basis, flex);

  return (
    <div ref={ref} className={styles.flex} {...rest}>
      {children}
    </div>
  );
});

Stack.displayName = 'Stack';

const getStyles = (
  theme: GrafanaTheme2,
  gap: StackProps['gap'],
  alignItems: StackProps['alignItems'],
  justifyContent: StackProps['justifyContent'],
  direction: StackProps['direction'],
  wrap: StackProps['wrap'],
  grow: StackProps['grow'],
  shrink: StackProps['shrink'],
  basis: StackProps['basis'],
  flex: StackProps['flex']
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
      getResponsiveStyle(theme, grow, (val) => ({
        flexGrow: val,
      })),
      getResponsiveStyle(theme, shrink, (val) => ({
        flexShrink: val,
      })),
      getResponsiveStyle(theme, basis, (val) => ({
        flexBasis: val,
      })),
      getResponsiveStyle(theme, flex, (val) => ({
        flex: val,
      })),
    ]),
  };
};
