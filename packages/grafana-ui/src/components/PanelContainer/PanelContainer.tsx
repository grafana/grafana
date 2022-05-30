import { css, cx } from '@emotion/css';
import React, { DetailedHTMLProps, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

type Props = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

const getStyles = (theme: GrafanaTheme2) =>
  css`
    background-color: ${theme.components.panel.background};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: 3px;
  `;
export const PanelContainer = ({ children, className, ...props }: Props) => {
  const css = useStyles2(getStyles);
  return (
    <div className={cx([css, className])} {...props}>
      {children}
    </div>
  );
};
