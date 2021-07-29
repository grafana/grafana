import React from 'react';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';

interface Props {
  children: React.ReactNode;
}

export const Grid = ({ children }: Props) => {
  const theme = useTheme2();

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
        grid-gap: ${theme.spacing(3)};
      `}
    >
      {children}
    </div>
  );
};
