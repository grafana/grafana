import { css } from '@emotion/css';
import React, { ElementType, useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';
interface BoxProps {
  margin?: ThemeSpacingTokens;
  marginX?: ThemeSpacingTokens;
  marginY?: ThemeSpacingTokens;
  marginTop?: ThemeSpacingTokens;
  marginBottom?: ThemeSpacingTokens;
  marginLeft?: ThemeSpacingTokens;
  marginRight?: ThemeSpacingTokens;

  padding?: ThemeSpacingTokens;
  paddingX?: ThemeSpacingTokens;
  paddingY?: ThemeSpacingTokens;
  paddingTop?: ThemeSpacingTokens;
  paddingBottom?: ThemeSpacingTokens;
  paddingLeft?: ThemeSpacingTokens;
  paddingRight?: ThemeSpacingTokens;

  backgroundColor?: keyof GrafanaTheme2['colors']['background'];
  display?: 'flex' | 'block' | 'inline' | 'none';
  element?: ElementType;
  grow?: number;
  shrink?: number;
  borderStyle?: 'solid' | 'dashed';
  borderColor?: keyof GrafanaTheme2['colors']['border'] | 'error' | 'success' | 'warning' | 'info';
}

export const Box = ({ children, ...props }: React.PropsWithChildren<BoxProps>) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));
  const Element = props.element ?? 'div';

  return <Element className={styles.root}>{children}</Element>;
};

Box.displayName = 'Box';

const customColor = (color: BoxProps['borderColor'], theme: GrafanaTheme2): string | undefined => {
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
      margin !== undefined && {
        margin: theme.spacing(margin),
      },
      marginX !== undefined && {
        marginLeft: theme.spacing(marginX),
        marginRight: theme.spacing(marginX),
      },
      marginY !== undefined && {
        marginTop: theme.spacing(marginY),
        marginBottom: theme.spacing(marginY),
      },
      marginTop !== undefined && {
        marginTop: theme.spacing(marginTop),
      },
      marginBottom !== undefined && {
        marginBottom: theme.spacing(marginBottom),
      },
      marginLeft !== undefined && {
        marginLeft: theme.spacing(marginLeft),
      },
      marginRight !== undefined && {
        marginRight: theme.spacing(marginRight),
      },
      padding !== undefined && {
        padding: theme.spacing(padding),
      },
      paddingX !== undefined && {
        paddingLeft: theme.spacing(paddingX),
        paddingRight: theme.spacing(paddingX),
      },
      paddingY !== undefined && {
        paddingTop: theme.spacing(paddingY),
        paddingBottom: theme.spacing(paddingY),
      },
      paddingTop !== undefined && {
        paddingTop: theme.spacing(paddingTop),
      },
      paddingBottom !== undefined && {
        paddingBottom: theme.spacing(paddingBottom),
      },
      paddingLeft !== undefined && {
        paddingLeft: theme.spacing(paddingLeft),
      },
      paddingRight !== undefined && {
        paddingRight: theme.spacing(paddingRight),
      },
      display && {
        display,
      },
      backgroundColor && {
        backgroundColor: theme.colors.background[backgroundColor],
      },
      (grow !== undefined || shrink !== undefined) && {
        flex: `${grow ?? 0} ${shrink ?? 1}`,
      },
      (borderStyle || borderColor) && {
        border: `1px ${borderStyle ?? 'solid'} ${
          borderColor ? customColor(borderColor, theme) : theme.colors.border.weak
        }`,
      },
    ]),
  };
};
