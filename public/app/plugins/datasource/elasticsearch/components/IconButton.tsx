import { Icon } from '@grafana/ui';
import { cx } from 'emotion';
import React, { FunctionComponent, ComponentProps } from 'react';

interface Props {
  iconName: ComponentProps<typeof Icon>['name'];
  onClick: () => void;
  className?: string;
}

export const IconButton: FunctionComponent<Props> = ({ iconName, onClick, className }) => (
  <button className={cx('gf-form-label gf-form-label--btn query-part', className)} onClick={onClick}>
    <Icon name={iconName} />
  </button>
);
