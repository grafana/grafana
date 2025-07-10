import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { AlignItems, Direction, FlexProps, JustifyContent, Wrap } from '../types';
import { ResponsiveProp, getResponsiveStyle } from '../utils/responsiveness';
import { getSizeStyles, SizeProps } from '../utils/styles';

interface StackProps extends FlexProps, SizeProps, Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  gap?: ResponsiveProp<ThemeSpacingTokens>;
  rowGap?: ResponsiveProp<ThemeSpacingTokens>;
  columnGap?: ResponsiveProp<ThemeSpacingTokens>;
  alignItems?: ResponsiveProp<AlignItems>;
  justifyContent?: ResponsiveProp<JustifyContent>;
  direction?: ResponsiveProp<Direction>;
  wrap?: ResponsiveProp<Wrap>;
  children?: React.ReactNode;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>((props, ref) => {
  const {
    gap = 1,
    rowGap,
    columnGap,
    alignItems,
    justifyContent,
    direction,
    wrap,
    children,
    grow,
    shrink,
    basis,
    flex,
    width,
    minWidth,
    maxWidth,
    height,
    minHeight,
    maxHeight,
    ...rest
  } = props;
  const styles = useStyles2(
    getStyles,
    gap,
    rowGap,
    columnGap,
    alignItems,
    justifyContent,
    direction,
    wrap,
    grow,
    shrink,
    basis,
    flex
  );
  const sizeStyles = useStyles2(getSizeStyles, width, minWidth, maxWidth, height, minHeight, maxHeight);
  return (
    <div ref={ref} className={cx(styles.flex, sizeStyles)} {...rest}>
      {children}
    </div>
  );
});

Stack.displayName = 'Stack';

const getStyles = (
  theme: GrafanaTheme2,
  gap: StackProps['gap'],
  rowGap: StackProps['rowGap'],
  columnGap: StackProps['columnGap'],
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
        flexWrap: typeof val === 'boolean' ? (val ? 'wrap' : 'nowrap') : val,
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
      getResponsiveStyle(theme, rowGap, (val) => ({
        rowGap: theme.spacing(val),
      })),
      getResponsiveStyle(theme, columnGap, (val) => ({
        columnGap: theme.spacing(val),
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
