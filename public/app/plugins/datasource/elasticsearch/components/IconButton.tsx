import { Icon } from '@grafana/ui';
import { cx } from 'emotion';
import React, { FunctionComponent, ComponentProps, ButtonHTMLAttributes } from 'react';

interface Props {
  iconName: ComponentProps<typeof Icon>['name'];
  onClick: () => void;
  className?: string;
}

// TODO: The button misses a screen readers hidden content to describe itself
export const IconButton: FunctionComponent<Props & ButtonHTMLAttributes<HTMLButtonElement>> = ({
  iconName,
  onClick,
  className,
  ...buttonProps
}) => (
  <button className={cx('gf-form-label gf-form-label--btn query-part', className)} onClick={onClick} {...buttonProps}>
    <Icon name={iconName} aria-hidden="true" />
  </button>
);
