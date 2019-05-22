import React from 'react';
import { cx } from 'emotion';

export interface SeriesIconProps {
  color: string;
  className?: string;
}
export const SeriesIcon: React.FunctionComponent<SeriesIconProps> = ({ color, className }) => {
  return <i className={cx('fa', 'fa-minus', className)} style={{ color }} />;
};
