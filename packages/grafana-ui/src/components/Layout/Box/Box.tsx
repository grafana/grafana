import { css } from '@emotion/css';
import React, { ElementType, useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { ResponsiveProp, getResponsiveStyle } from '../ResponsiveTypes';

type Display = 'flex' | 'block' | 'inline' | 'none';
type BackgroundColor = keyof GrafanaTheme2['colors']['background'];
type BorderStyle = 'solid' | 'dashed';
type BorderColor = keyof GrafanaTheme2['colors']['border'] | 'error' | 'success' | 'warning' | 'info';

interface BoxProps {
  margin?: ResponsiveProp<ThemeSpacingTokens>;
  marginX?: ResponsiveProp<ThemeSpacingTokens>;
  marginY?: ResponsiveProp<ThemeSpacingTokens>;
  marginTop?: ResponsiveProp<ThemeSpacingTokens>;
  marginBottom?: ResponsiveProp<ThemeSpacingTokens>;
  marginLeft?: ResponsiveProp<ThemeSpacingTokens>;
  marginRight?: ResponsiveProp<ThemeSpacingTokens>;

  padding?: ResponsiveProp<ThemeSpacingTokens>;
  paddingX?: ResponsiveProp<ThemeSpacingTokens>;
  paddingY?: ResponsiveProp<ThemeSpacingTokens>;
  paddingTop?: ResponsiveProp<ThemeSpacingTokens>;
  paddingBottom?: ResponsiveProp<ThemeSpacingTokens>;
  paddingLeft?: ResponsiveProp<ThemeSpacingTokens>;
  paddingRight?: ResponsiveProp<ThemeSpacingTokens>;

  backgroundColor?: ResponsiveProp<BackgroundColor>;
  display?: ResponsiveProp<Display>;
  grow?: ResponsiveProp<number>;
  shrink?: ResponsiveProp<number>;
  borderStyle?: ResponsiveProp<BorderStyle>;
  borderColor?: ResponsiveProp<BorderColor>;
  element?: ElementType;
}

export const Box = ({ children, ...props }: React.PropsWithChildren<BoxProps>) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));
  const Element = props.element ?? 'div';

  return <Element className={styles.root}>{children}</Element>;
};

Box.displayName = 'Box';

const customColor = (color: BorderColor, theme: GrafanaTheme2): string | undefined => {
  switch (color) {
    case 'error':
      return theme.colors.error.border;
    case 'success':
      return theme.colors.success.border;
    case 'info':
      return theme.colors.info.border;
    case 'warning':
      return theme.colors.warning.border;
    default:
      return color ? theme.colors.border[color] : undefined;
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
        backgroundColor: theme.colors.background[val],
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
        borderColor: customColor(val, theme),
      })),
      (borderStyle || borderColor) && {
        borderWidth: '1px',
      },
    ]),
  };
};
