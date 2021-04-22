import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, stylesFactory } from '@grafana/ui';

interface Props {
  onClick?: () => void;
  children: React.ReactNode;
}

export const Card = ({ onClick, children }: Props) => {
  const theme = useTheme();
  const styles = getCardStyles(theme);

  return (
    <div onClick={onClick} className={styles.root}>
      {children}
    </div>
  );
};

export const getCardStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    root: css`
      padding: ${theme.spacing.md};
      background-color: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      height: 100%;

      & img {
        max-width: 100%;
        margin: auto 0;
      }

      &:hover {
        background-color: ${theme.isDark ? '#25272b' : '#eaf0f6'};
        cursor: pointer;
      }
    `,
  };
});
