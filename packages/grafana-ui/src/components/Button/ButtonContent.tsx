import React from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { ButtonSize } from './types';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  content: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
    height: 100%;
  `,

  icon: css`
    position: relative;
    top: 1px;
    & + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
}));

type Props = {
  icon?: string;
  className?: string;
  children: React.ReactNode;
  size?: ButtonSize;
};

export function ButtonContent(props: Props) {
  const { icon, children } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!children) {
    return (
      <span className={styles.content}>
        <i className={icon} />
      </span>
    );
  }

  const iconElement = icon && (
    <span className={styles.icon}>
      <i className={icon} />
    </span>
  );

  return (
    <span className={styles.content}>
      {iconElement}
      <span>{children}</span>
    </span>
  );
}
