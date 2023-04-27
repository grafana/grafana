import { css } from '@emotion/css';
import React from 'react';

import { useTheme2 } from '../../themes';

export interface Props {
  children?: React.ReactNode;
}

export const DashboardStoryCanvas = ({ children }: Props) => {
  const theme = useTheme2();
  const style = css`
    width: 100%;
    height: 100%;
    padding: 32px;
    background: ${theme.colors.background.canvas};
    overflow: auto;
  `;

  return <div className={style}>{children}</div>;
};

DashboardStoryCanvas.displayName = 'DashboardStoryCanvas';
