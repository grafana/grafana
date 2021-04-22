import React from 'react';
import { css } from '@emotion/css';

import { useTheme } from '@grafana/ui';

interface HorizontalGroupProps {
  children: React.ReactNode;
}

export const HorizontalGroup = ({ children }: HorizontalGroupProps) => {
  const theme = useTheme();

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        & > * {
          margin-right: ${theme.spacing.xs};
        }
        & > *:first-child {
          flex-grow: 1;
        }
        & > *:last-child {
          margin-right: 0;
        }
      `}
    >
      {children}
    </div>
  );
};
