import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { getResponsiveStyle, ResponsiveProp } from './utils/responsiveness';

export interface SpaceProps {
  /**
   * The amount of vertical space to use.
   */
  v?: ResponsiveProp<ThemeSpacingTokens>;
  /**
   * The amount of horizontal space to use.
   */
  h?: ResponsiveProp<ThemeSpacingTokens>;
  /**
   * The layout of the space. If set `inline`, the space will behave like an inline-block element,
   * otherwise it will behave like a block element.
   */
  layout?: 'block' | 'inline';
}

export const Space = (props: SpaceProps) => {
  const styles = useStyles2(getStyles, props);
  return <span className={cx(styles.wrapper)} />;
};

Space.defaultProps = {
  v: 0,
  h: 0,
  layout: 'block',
};

const getStyles = (theme: GrafanaTheme2, props: SpaceProps) => ({
  wrapper: css([
    getResponsiveStyle(theme, props.h, (val) => ({
      paddingRight: theme.spacing(val),
    })),
    getResponsiveStyle(theme, props.v, (val) => ({
      paddingBottom: theme.spacing(val),
    })),
    props.layout === 'inline' && {
      display: 'inline-block',
    },
    props.layout === 'block' && {
      display: 'block',
    },
  ]),
});
