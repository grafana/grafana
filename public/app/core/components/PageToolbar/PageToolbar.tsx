import React, { FC, ReactNode } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { HorizontalGroup, stylesFactory, useTheme } from '@grafana/ui';

interface Props {
  title: string;
  titlePrefix?: ReactNode;
  actions: ReactNode[];
  titlePadding?: 'sm' | 'lg';
}

export const PageToolbar: FC<Props> = ({ actions, title, titlePrefix, titlePadding = 'lg' }) => {
  const styles = getStyles(useTheme(), titlePadding);
  return (
    <div className={styles.toolbarWrapper}>
      <HorizontalGroup justify="space-between" align="center">
        <div className={styles.toolbarLeft}>
          <HorizontalGroup spacing="none">
            {titlePrefix}
            <span className={styles.toolbarTitle}>{title}</span>
          </HorizontalGroup>
        </div>
        <HorizontalGroup spacing="sm" align="center">
          {actions}
        </HorizontalGroup>
      </HorizontalGroup>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, padding: string) => {
  const titlePadding = padding === 'sm' ? theme.spacing.sm : theme.spacing.md;

  return {
    toolbarWrapper: css`
      display: flex;
      padding: ${theme.spacing.sm};
      background: ${theme.colors.panelBg};
      justify-content: space-between;
      border-bottom: 1px solid ${theme.colors.panelBorder};
    `,
    toolbarLeft: css`
      padding-left: ${theme.spacing.sm};
    `,
    toolbarTitle: css`
      font-size: ${theme.typography.size.lg};
      padding-left: ${titlePadding};
    `,
  };
});
