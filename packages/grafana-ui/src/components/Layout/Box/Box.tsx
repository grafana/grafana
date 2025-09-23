import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { ElementType, forwardRef, PropsWithChildren } from 'react';
import * as React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens, ThemeShape, ThemeShadows } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { AlignItems, Direction, FlexProps, JustifyContent } from '../types';
import { ResponsiveProp, getResponsiveStyle } from '../utils/responsiveness';
import { getSizeStyles, SizeProps } from '../utils/styles';

type Display = 'flex' | 'block' | 'inline' | 'inline-block' | 'none';
export type BackgroundColor = keyof GrafanaTheme2['colors']['background'] | 'error' | 'success' | 'warning' | 'info';
export type BorderStyle = 'solid' | 'dashed';
export type BorderColor = keyof GrafanaTheme2['colors']['border'] | 'error' | 'success' | 'warning' | 'info';
export type BorderRadius = keyof ThemeShape['radius'];
export type BoxShadow = keyof ThemeShadows;

export interface BoxProps extends FlexProps, SizeProps, Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  // Margin props
  /** Sets the property `margin` */
  margin?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the properties `margin-top` and `margin-bottom`. Higher priority than margin. */
  marginX?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the properties `margin-left` and `margin-right`. Higher priority than margin. */
  marginY?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `margin-top`. Higher priority than margin and marginY. */
  marginTop?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `margin-bottom`. Higher priority than margin and marginXY */
  marginBottom?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `margin-left`. Higher priority than margin and marginX. */
  marginLeft?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `margin-right`. Higher priority than margin and marginX. */
  marginRight?: ResponsiveProp<ThemeSpacingTokens>;

  // Padding props
  /** Sets the property `padding` */
  padding?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the properties `padding-top` and `padding-bottom`. Higher priority than padding. */
  paddingX?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the properties `padding-left` and `padding-right`. Higher priority than padding. */
  paddingY?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `padding-top`. Higher priority than padding and paddingY. */
  paddingTop?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `padding-bottom`. Higher priority than padding and paddingY. */
  paddingBottom?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `padding-left`. Higher priority than padding and paddingX. */
  paddingLeft?: ResponsiveProp<ThemeSpacingTokens>;
  /** Sets the property `padding-right`. Higher priority than padding and paddingX. */
  paddingRight?: ResponsiveProp<ThemeSpacingTokens>;

  // Border Props
  borderStyle?: ResponsiveProp<BorderStyle>;
  borderColor?: ResponsiveProp<BorderColor>;
  borderRadius?: ResponsiveProp<BorderRadius>;

  // Flex Props
  alignItems?: ResponsiveProp<AlignItems>;
  direction?: ResponsiveProp<Direction>;
  justifyContent?: ResponsiveProp<JustifyContent>;
  gap?: ResponsiveProp<ThemeSpacingTokens>;

  // Other props
  backgroundColor?: ResponsiveProp<BackgroundColor>;
  display?: ResponsiveProp<Display>;
  boxShadow?: ResponsiveProp<BoxShadow>;
  /** Sets the HTML element that will be rendered as a Box. Defaults to 'div' */
  element?: ElementType;
  position?: ResponsiveProp<Property.Position>;
}

export const Box = forwardRef<HTMLElement, PropsWithChildren<BoxProps>>((props, ref) => {
  const {
    children,
    margin,
    marginX,
    marginY,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    display,
    backgroundColor,
    grow,
    shrink,
    basis,
    flex,
    borderColor,
    borderStyle,
    borderRadius,
    direction,
    justifyContent,
    alignItems,
    boxShadow,
    element,
    gap,
    width,
    minWidth,
    maxWidth,
    height,
    minHeight,
    maxHeight,
    position,
    ...rest
  } = props;
  const styles = useStyles2(
    getStyles,
    margin,
    marginX,
    marginY,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    display,
    backgroundColor,
    grow,
    shrink,
    basis,
    flex,
    borderColor,
    borderStyle,
    borderRadius,
    direction,
    justifyContent,
    alignItems,
    boxShadow,
    gap,
    position
  );
  const sizeStyles = useStyles2(getSizeStyles, width, minWidth, maxWidth, height, minHeight, maxHeight);
  const Element = element ?? 'div';

  return (
    <Element ref={ref} className={cx(styles.root, sizeStyles)} {...rest}>
      {children}
    </Element>
  );
});

Box.displayName = 'Box';

const customBorderColor = (color: BorderColor, theme: GrafanaTheme2) => {
  switch (color) {
    case 'error':
    case 'success':
    case 'info':
    case 'warning':
      return theme.colors[color].borderTransparent;
    default:
      return color ? theme.colors.border[color] : undefined;
  }
};

const customBackgroundColor = (color: BackgroundColor, theme: GrafanaTheme2) => {
  switch (color) {
    case 'error':
    case 'success':
    case 'info':
    case 'warning':
      return theme.colors[color].transparent;
    default:
      return color ? theme.colors.background[color] : undefined;
  }
};

const getStyles = (
  theme: GrafanaTheme2,
  margin: BoxProps['margin'],
  marginX: BoxProps['marginX'],
  marginY: BoxProps['marginY'],
  marginTop: BoxProps['marginTop'],
  marginBottom: BoxProps['marginBottom'],
  marginLeft: BoxProps['marginLeft'],
  marginRight: BoxProps['marginRight'],
  padding: BoxProps['padding'],
  paddingX: BoxProps['paddingX'],
  paddingY: BoxProps['paddingY'],
  paddingTop: BoxProps['paddingTop'],
  paddingBottom: BoxProps['paddingBottom'],
  paddingLeft: BoxProps['paddingLeft'],
  paddingRight: BoxProps['paddingRight'],
  display: BoxProps['display'],
  backgroundColor: BoxProps['backgroundColor'],
  grow: BoxProps['grow'],
  shrink: BoxProps['shrink'],
  basis: BoxProps['basis'],
  flex: BoxProps['flex'],
  borderColor: BoxProps['borderColor'],
  borderStyle: BoxProps['borderStyle'],
  borderRadius: BoxProps['borderRadius'],
  direction: BoxProps['direction'],
  justifyContent: BoxProps['justifyContent'],
  alignItems: BoxProps['alignItems'],
  boxShadow: BoxProps['boxShadow'],
  gap: BoxProps['gap'],
  position: BoxProps['position']
) => {
  return {
    root: css([
      getResponsiveStyle(theme, margin, (val) => ({
        margin: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginX, (val) => ({
        marginLeft: theme.spacing(val),
        marginRight: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginY, (val) => ({
        marginTop: theme.spacing(val),
        marginBottom: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginTop, (val) => ({
        marginTop: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginBottom, (val) => ({
        marginBottom: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginLeft, (val) => ({
        marginLeft: theme.spacing(val),
      })),
      getResponsiveStyle(theme, marginRight, (val) => ({
        marginRight: theme.spacing(val),
      })),
      getResponsiveStyle(theme, padding, (val) => ({
        padding: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingX, (val) => ({
        paddingLeft: theme.spacing(val),
        paddingRight: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingY, (val) => ({
        paddingTop: theme.spacing(val),
        paddingBottom: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingTop, (val) => ({
        paddingTop: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingBottom, (val) => ({
        paddingBottom: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingLeft, (val) => ({
        paddingLeft: theme.spacing(val),
      })),
      getResponsiveStyle(theme, paddingRight, (val) => ({
        paddingRight: theme.spacing(val),
      })),
      getResponsiveStyle(theme, display, (val) => ({
        display: val,
      })),
      getResponsiveStyle(theme, backgroundColor, (val) => ({
        backgroundColor: customBackgroundColor(val, theme),
      })),
      getResponsiveStyle(theme, direction, (val) => ({
        flexDirection: val,
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
      getResponsiveStyle(theme, borderStyle, (val) => ({
        borderStyle: val,
      })),
      getResponsiveStyle(theme, borderColor, (val) => ({
        borderColor: customBorderColor(val, theme),
      })),
      (borderStyle || borderColor) && {
        borderWidth: '1px',
      },
      getResponsiveStyle(theme, justifyContent, (val) => ({
        justifyContent: val,
      })),
      getResponsiveStyle(theme, alignItems, (val) => ({
        alignItems: val,
      })),
      getResponsiveStyle(theme, borderRadius, (val) => ({
        borderRadius: theme.shape.radius[val],
      })),
      getResponsiveStyle(theme, boxShadow, (val) => ({
        boxShadow: theme.shadows[val],
      })),
      getResponsiveStyle(theme, gap, (val) => ({
        gap: theme.spacing(val),
      })),
      getResponsiveStyle(theme, position, (val) => ({
        position: val,
      })),
    ]),
  };
};
