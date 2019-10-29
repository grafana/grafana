import React from 'react';
import cx from 'classnames';

type Props = {
  icon?: string;
  className: string;
  iconClassName: string;
  children: React.ReactNode;
};
export function ButtonContent(props: Props) {
  const { icon, className, iconClassName, children } = props;
  return icon ? (
    <span className={className}>
      <i className={cx([icon, iconClassName])} />
      <span>{children}</span>
    </span>
  ) : (
    <>{children}</>
  );
}
