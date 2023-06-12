import { cx, css } from '@emotion/css';
import React from 'react';

import { stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';

const getStyles = stylesFactory((size: number | string, inline: boolean) => {
  return css([
    {
      fontSize: typeof size === 'string' ? size : `${size}px`,
    },
    inline && { display: 'inline-block' },
  ]);
});

export type Props = {
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  inline?: boolean;
  size?: number | string;
};

/**
 * @public
 */
export const Spinner = ({ className, inline = false, iconClassName, style, size = 16 }: Props) => {
  const styles = getStyles(size, inline);
  return (
    <div data-testid="Spinner" style={style} className={cx(styles, className)}>
      <Icon className={cx('fa-spin', iconClassName)} name="fa fa-spinner" />
    </div>
  );
};
