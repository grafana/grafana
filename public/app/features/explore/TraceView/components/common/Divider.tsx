import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    Divider: css`
      background: ${autoColor(theme, '#ddd')};
    `,

    DividerVertical: css`
      label: DividerVertical;
      display: inline-block;
      width: 1px;
      height: 0.9em;
      margin: 0 8px;
      vertical-align: middle;
    `,

    DividerHorizontal: css`
      label: DividerHorizontal;
      display: block;
      height: 1px;
      width: 100%;
      margin: 24px 0;
      clear: both;
      vertical-align: middle;
      position: relative;
      top: -0.06em;
    `,
  };
};

interface Props {
  className?: string;
  style?: React.CSSProperties;
  type?: 'vertical' | 'horizontal';
}
export function Divider({ className, style, type }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div
      style={style}
      className={cx(
        styles.Divider,
        type === 'horizontal' ? styles.DividerHorizontal : styles.DividerVertical,
        className
      )}
    />
  );
}
