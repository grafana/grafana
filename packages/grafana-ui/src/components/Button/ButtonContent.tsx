import React from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { ComponentSize } from '../../types/size';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  content: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
    height: 100%;
  `,

  icon: css`
    & + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
}));

type Props = {
  icon?: IconName;
  className?: string;
  children: React.ReactNode;
  size?: ComponentSize;
};

export function ButtonContent(props: Props) {
  const { icon, children, size } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!children) {
    return <span className={styles.content}>{icon && <Icon name={icon} size={size} />}</span>;
  }

  const iconElement = icon && (
    <span className={styles.icon}>
      <Icon name={icon} size={size} />
    </span>
  );

  return (
    <span className={styles.content}>
      {iconElement}
      <span>{children}</span>
    </span>
  );
}
