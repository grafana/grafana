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

export const Card = ({ href, header, content, footer }: Props) => {
  const styles = useStyles2(getCardStyles);

  return (
    <a href={href} className={styles.root}>
      <div className={styles.spacer}>{header}</div>
      <div className={cx(styles.spacer, styles.block)}>{content}</div>
      <div>{footer}</div>
    </a>
  );
};

const getCardStyles = (theme: GrafanaTheme2) => ({
  root: css`
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: ${theme.spacing(2)};

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
