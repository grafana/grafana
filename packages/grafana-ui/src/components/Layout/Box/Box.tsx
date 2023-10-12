import { css } from '@emotion/css';
import React, { ElementType } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens, ThemeShape, ThemeShadows } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { AlignItems, JustifyContent } from '../Flex/Flex';
import { ResponsiveProp, getResponsiveStyle } from '../utils/responsiveness';

type Display = 'flex' | 'block' | 'inline' | 'none';
export type BackgroundColor = keyof GrafanaTheme2['colors']['background'] | 'error' | 'success' | 'warning' | 'info';
export type BorderStyle = 'solid' | 'dashed';
export type BorderColor = keyof GrafanaTheme2['colors']['border'] | 'error' | 'success' | 'warning' | 'info';
export type BorderRadius = keyof ThemeShape['radius'];
export type BoxShadow = keyof ThemeShadows;

interface BoxProps {
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
  /** Sets the property `flex` */
  grow?: ResponsiveProp<number>;
  /** Sets the property `flex-shrink` */
  shrink?: ResponsiveProp<number>;
  alignItems?: ResponsiveProp<AlignItems>;
  justifyContent?: ResponsiveProp<JustifyContent>;

  // Other props
  backgroundColor?: ResponsiveProp<BackgroundColor>;
  display?: ResponsiveProp<Display>;
  boxShadow?: ResponsiveProp<BoxShadow>;
  /** Sets the HTML element that will be rendered as a Box. Defaults to 'div' */
  element?: ElementType;
}

export const Box = ({
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
  borderColor,
  borderStyle,
  borderRadius,
  justifyContent,
  alignItems,
  boxShadow,
  element,
}: React.PropsWithChildren<BoxProps>) => {
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
    borderColor,
    borderStyle,
    borderRadius,
    justifyContent,
    alignItems,
    boxShadow
  );
  const Element = element ?? 'div';

  return <Element className={styles.root}>{children}</Element>;
};

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
  borderColor: BoxProps['borderColor'],
  borderStyle: BoxProps['borderStyle'],
  borderRadius: BoxProps['borderRadius'],
  justifyContent: BoxProps['justifyContent'],
  alignItems: BoxProps['alignItems'],
  boxShadow: BoxProps['boxShadow']
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
      getResponsiveStyle(theme, grow, (val) => ({
        flex: val,
      })),
      getResponsiveStyle(theme, shrink, (val) => ({
        flexShrink: val,
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
    ]),
  };
};
