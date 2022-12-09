import { css } from '@emotion/css';
import React, { FC } from 'react';

import { useTheme2 } from '../../themes';

export interface Props {
  children?: React.ReactNode;
}

export const DashboardStoryCanvas: FC<Props> = ({ children }) => {
  const theme = useTheme2();
  const style = css`
    width: 100%;
    height: 100%;
    padding: 32px;
    background: ${theme.colors.background.canvas};
  `;

  return <div className={style}>{children}</div>;
};

DashboardStoryCanvas.displayName = 'DashboardStoryCanvas';
