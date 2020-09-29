import React from 'react';
import { getPointConfig } from './configGetters';
import { useSeriesGeometry } from './SeriesGeometry';
import { PointProps } from './types';

export const Point: React.FC<PointProps> = ({ size = 2, stroke, scaleKey }) => {
  const getConfig = () => getPointConfig({ size, stroke, scaleKey });
  useSeriesGeometry(getConfig);

  return null;
};
Point.displayName = 'Point';
