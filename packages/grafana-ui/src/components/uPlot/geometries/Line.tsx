import React from 'react';
import { getLineConfig } from './configGetters';
import { useSeriesGeometry } from './SeriesGeometry';
import { LineProps } from './types';

export const Line: React.FC<LineProps> = props => {
  const getConfig = () => getLineConfig(props);
  useSeriesGeometry(getConfig);

  return null;
};

Line.displayName = 'Line';
