import React, { ReactElement } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
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
    position: relative;
    top: 1px;
    & + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
}));

type Props = {
  icon?: string | ReactElement;
  className?: string;
  children: React.ReactNode;
  size?: ComponentSize;
};

export function ButtonContent(props: Props) {
  const { icon, children } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const iconElement = typeof icon === 'string' ? <i className={icon} /> : icon;

  if (!children) {
    return <span className={styles.content}>{iconElement}</span>;
  }

  const iconWrapper = iconElement && <span className={styles.icon}>{iconElement}</span>;

  return (
    <span className={styles.content}>
      {iconWrapper}
      <span>{children}</span>
    </span>
  );
}
