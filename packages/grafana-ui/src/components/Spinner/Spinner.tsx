import { cx, css } from '@emotion/css';
import React from 'react';

import { stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';

const getStyles = stylesFactory((size: number, inline: boolean) => {
  return {
    wrapper: css`
      font-size: ${size}px;
      ${inline
        ? css`
            display: inline-block;
          `
        : ''}
    `,
  };
});

export type Props = {
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  inline?: boolean;
  size?: number;
};

/**
 * @public
 */
export const Spinner = ({ className, inline = false, iconClassName, style, size = 16 }: Props) => {
  const styles = getStyles(size, inline);
  return (
    <div data-testid="Spinner" style={style} className={cx(styles.wrapper, className)}>
      <Icon className={cx('fa-spin', iconClassName)} name="fa fa-spinner" />
    </div>
  );
};
