import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  href: string;
  header: React.ReactNode;
  content: React.ReactNode;
  footer: React.ReactNode;
}

export const Tile = ({ href, header, content, footer }: Props) => {
  const styles = useStyles2(getTileStyles);

  return (
    <a href={href} className={styles.root}>
      <div className={styles.spacer}>{header}</div>
      <div className={cx(styles.spacer)}>{content}</div>
      <div>{footer}</div>
    </a>
  );
};

const getTileStyles = (theme: GrafanaTheme2) => ({
  root: css`
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: ${theme.spacing(3)};

    &:hover {
      background-color: ${theme.colors.action.hover};
    }
  `,
  spacer: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  block: css`
    flex-grow: 1;
  `,
});
