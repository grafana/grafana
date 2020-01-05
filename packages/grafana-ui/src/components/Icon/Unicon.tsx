import React from 'react';
import { cx, css } from 'emotion';
import { stylesFactory } from '../../themes';

export interface UniconProps {
  name: string;
  className?: string;
}

const getIconStyles = stylesFactory(() => {
  return {
    icon: css`
      display: inline-block;
      /* width: 16px;
      height: 16px; */
      text-align: center;
      /* font-size: 14px; */
      &:before {
        vertical-align: middle;
      }
    `,
  };
});

export const Unicon: React.FC<UniconProps> = ({ name, className }) => {
  const styles = getIconStyles();
  return <i className={cx(styles.icon, 'uil', `uil-${name}`, className)} />;
};

Unicon.displayName = 'Unicon';
