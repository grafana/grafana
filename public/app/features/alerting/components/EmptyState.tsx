import React, { FC, ReactNode } from 'react';
import { css } from '@emotion/css';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  title: string;
  children: ReactNode | ReactNode[];
}

export const EmptyState: FC<Props> = ({ children, title }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.emptyState}>
      <h4 className={styles.emptyStateHeader}>{title}</h4>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    emptyState: css`
      color: ${theme.colors.textSemiWeak};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
      width: 100%;
    `,
    emptyStateHeader: css`
      color: ${theme.colors.textSemiWeak};
    `,
  };
};
