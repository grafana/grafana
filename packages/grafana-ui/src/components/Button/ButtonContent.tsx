import React from 'react';
import { css } from 'emotion';
import { stylesFactory } from '../../themes';

const getStyles = stylesFactory(() => ({
  content: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
    height: 100%;
  `,
}));

type Props = {
  icon?: string;
  className?: string;
  iconClassName?: string;
  children: React.ReactNode;
};
export function ButtonContent(props: Props) {
  const { icon, iconClassName, children } = props;
  const styles = getStyles();

  const iconElement = icon && (
    <span className={iconClassName}>
      <i className={icon} />
    </span>
  );

  return (
    <span className={styles.content}>
      {iconElement}
      {children}
    </span>
  );
}
