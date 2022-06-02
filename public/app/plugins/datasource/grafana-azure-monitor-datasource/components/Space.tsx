import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';

export interface SpaceProps {
  v?: number;
  h?: number;
  layout?: 'block' | 'inline';
}

export const Space = (props: SpaceProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, props);

  return <span className={cx(styles.wrapper)} />;
};

Space.defaultProps = {
  v: 0,
  h: 0,
  layout: 'block',
};

const getStyles = stylesFactory((theme: GrafanaTheme2, props: SpaceProps) => ({
  wrapper: css([
    {
      paddingRight: theme.spacing(props.h ?? 0),
      paddingBottom: theme.spacing(props.v ?? 0),
    },
    props.layout === 'inline' && {
      display: 'inline-block',
    },
    props.layout === 'block' && {
      display: 'block',
    },
  ]),
}));
