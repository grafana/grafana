import React, { useCallback } from 'react';
import { getLineConfig } from './configGetters';
import { useSeriesGeometry } from './SeriesGeometry';
import { LineProps } from './types';

export const Line: React.FC<LineProps> = props => {
  const getConfig = useCallback(() => getLineConfig(props), [props]);
  useSeriesGeometry(getConfig);

  return null;
};

Line.displayName = 'Line';
