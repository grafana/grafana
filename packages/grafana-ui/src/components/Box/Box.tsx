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
}

export const Box = ({ children, ...props }: React.PropsWithChildren<BoxProps>) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));
  const Element = props.element ?? 'div';

  return <Element className={styles.root}>{children}</Element>;
};

Box.displayName = 'Box';

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
      {
        backgroundColor: theme.colors.background[backgroundColor ?? 'primary'],
      },
    ]),
  };
};
