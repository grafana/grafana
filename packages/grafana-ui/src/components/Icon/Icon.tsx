import React from 'react';
import { cx, css } from 'emotion';
import { stylesFactory } from '../../themes';
import { IconType } from './types';

export interface IconProps {
  name: IconType;
  className?: string;
}

const getIconStyles = stylesFactory(() => {
  return {
    icon: css`
      display: inline-block;
      width: 16px;
      height: 16px;
      text-align: center;
      font-size: 14px;
      &:before {
        vertical-align: middle;
      }
    `,
  };
});

export const Icon: React.FC<IconProps> = ({ name, className }) => {
  const styles = getIconStyles();
  return <i className={cx(styles.icon, 'fa', `fa-${name}`, className)} />;
};

Icon.displayName = 'Icon';
