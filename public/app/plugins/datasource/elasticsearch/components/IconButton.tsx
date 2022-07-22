import { cx, css } from '@emotion/css';
import React, { ComponentProps, ButtonHTMLAttributes } from 'react';

import { Icon } from '@grafana/ui';

const SROnly = css`
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

interface Props {
  iconName: ComponentProps<typeof Icon>['name'];
  onClick: () => void;
  className?: string;
  label: string;
}

export const IconButton = ({
  iconName,
  onClick,
  className,
  label,
  ...buttonProps
}: Props & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cx('gf-form-label gf-form-label--btn query-part', className)} onClick={onClick} {...buttonProps}>
    <span className={SROnly}>{label}</span>
    <Icon name={iconName} aria-hidden="true" />
  </button>
);
