import React from 'react';
import { css } from 'emotion';
import { useTheme } from '@grafana/ui';

interface Props {
  children: React.ReactNode;
}

export const Grid = ({ children }: Props) => {
  const theme = useTheme();

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
        grid-gap: ${theme.spacing.sm};
      `}
    >
      {children}
    </div>
  );
};
