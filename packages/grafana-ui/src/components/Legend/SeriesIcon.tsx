import React from 'react';
import { Icon } from '../Icon/Icon';

export interface SeriesIconProps {
  color: string;
  className?: string;
}

export const SeriesIcon: React.FunctionComponent<SeriesIconProps> = ({ color, className }) => {
  return <Icon name="minus" className={className} style={{ color }} />;
};

SeriesIcon.displayName = 'SeriesIcon';
