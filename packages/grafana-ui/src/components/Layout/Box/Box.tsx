import { css } from '@emotion/css';
import React, { ElementType, useCallback } from 'react';

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
  margin?: ResponsiveProp<ThemeSpacingTokens>;
  marginX?: ResponsiveProp<ThemeSpacingTokens>;
  marginY?: ResponsiveProp<ThemeSpacingTokens>;
  marginTop?: ResponsiveProp<ThemeSpacingTokens>;
  marginBottom?: ResponsiveProp<ThemeSpacingTokens>;
  marginLeft?: ResponsiveProp<ThemeSpacingTokens>;
  marginRight?: ResponsiveProp<ThemeSpacingTokens>;

  // Padding props
  padding?: ResponsiveProp<ThemeSpacingTokens>;
  paddingX?: ResponsiveProp<ThemeSpacingTokens>;
  paddingY?: ResponsiveProp<ThemeSpacingTokens>;
  paddingTop?: ResponsiveProp<ThemeSpacingTokens>;
  paddingBottom?: ResponsiveProp<ThemeSpacingTokens>;
  paddingLeft?: ResponsiveProp<ThemeSpacingTokens>;
  paddingRight?: ResponsiveProp<ThemeSpacingTokens>;

  // Border Props
  borderStyle?: ResponsiveProp<BorderStyle>;
  borderColor?: ResponsiveProp<BorderColor>;
  borderRadius?: ResponsiveProp<BorderRadius>;

  // Flex Props
  grow?: ResponsiveProp<number>;
  shrink?: ResponsiveProp<number>;
  alignItems?: ResponsiveProp<AlignItems>;
  justifyContent?: ResponsiveProp<JustifyContent>;

  backgroundColor?: ResponsiveProp<BackgroundColor>;
  display?: ResponsiveProp<Display>;
  element?: ElementType;
  boxShadow?: ResponsiveProp<BoxShadow>;
}

export const Box = ({ children, ...props }: React.PropsWithChildren<BoxProps>) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));
  const Element = props.element ?? 'div';

  return <Element className={styles.root}>{children}</Element>;
};

Box.displayName = 'Box';

const customBorderColor = (color: BorderColor, theme: GrafanaTheme2): string | undefined => {
  switch (color) {
    case 'error':
    case 'success':
    case 'info':
    case 'warning':
      return theme.colors[color].border;
    default:
      return color ? theme.colors.border[color] : undefined;
  }
};

const customBackgroundColor = (color: BackgroundColor, theme: GrafanaTheme2): string | undefined => {
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

const getStyles = (theme: GrafanaTheme2, props: BoxProps) => {
  const {
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
  } = props;
  return {
    root: css([
      getResponsiveStyle<ThemeSpacingTokens>(theme, margin, (val) => ({
        margin: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginX, (val) => ({
        marginLeft: theme.spacing(val),
        marginRight: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginY, (val) => ({
        marginTop: theme.spacing(val),
        marginBottom: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginTop, (val) => ({
        marginTop: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginBottom, (val) => ({
        marginBottom: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginLeft, (val) => ({
        marginLeft: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, marginRight, (val) => ({
        marginRight: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, padding, (val) => ({
        padding: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingX, (val) => ({
        paddingLeft: theme.spacing(val),
        paddingRight: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingY, (val) => ({
        paddingTop: theme.spacing(val),
        paddingBottom: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingTop, (val) => ({
        paddingTop: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingBottom, (val) => ({
        paddingBottom: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingLeft, (val) => ({
        paddingLeft: theme.spacing(val),
      })),
      getResponsiveStyle<ThemeSpacingTokens>(theme, paddingRight, (val) => ({
        paddingRight: theme.spacing(val),
      })),
      getResponsiveStyle<Display>(theme, display, (val) => ({
        display: val,
      })),
      getResponsiveStyle<BackgroundColor>(theme, backgroundColor, (val) => ({
        backgroundColor: customBackgroundColor(val, theme),
      })),
      getResponsiveStyle<number>(theme, grow, (val) => ({
        flex: val,
      })),
      getResponsiveStyle<number>(theme, shrink, (val) => ({
        flexShrink: val,
      })),
      getResponsiveStyle<BorderStyle>(theme, borderStyle, (val) => ({
        borderStyle: val,
      })),
      getResponsiveStyle<BorderColor>(theme, borderColor, (val) => ({
        borderColor: customBorderColor(val, theme),
      })),
      (borderStyle || borderColor) && {
        borderWidth: '1px',
      },
      getResponsiveStyle<JustifyContent>(theme, justifyContent, (val) => ({
        justifyContent: val,
      })),
      getResponsiveStyle<AlignItems>(theme, alignItems, (val) => ({
        alignItems: val,
      })),
      getResponsiveStyle<BorderRadius>(theme, borderRadius, (val) => ({
        borderRadius: theme.shape.radius[val],
      })),
      getResponsiveStyle<BoxShadow>(theme, boxShadow, (val) => ({
        boxShadow: theme.shadows[val],
      })),
    ]),
  };
};
