import React, { useCallback, useEffect, useRef } from 'react';
import { ScaleProps } from './types';
import { usePlotConfigContext } from '../context';

import uPlot from 'uplot';

const useScaleConfig = (scaleKey: string, getConfig: () => any) => {
  const { addScale } = usePlotConfigContext();
  const updateConfigRef = useRef<(c: uPlot.Scale) => void>(() => {});

  const defaultScaleConfig: uPlot.Scale = {};

  const getUpdateConfigRef = useCallback(() => {
    return updateConfigRef.current;
  }, [updateConfigRef]);

  useEffect(() => {
    const config = getConfig();
    const { removeScale, updateScale } = addScale(scaleKey, { ...defaultScaleConfig, ...config });
    updateConfigRef.current = updateScale;
    return () => {
      removeScale();
    };
  }, []);

  // update series config when config getter is updated
  useEffect(() => {
    const config = getConfig();
    getUpdateConfigRef()({ ...defaultScaleConfig, ...config });
  }, [getConfig]);
};

export const Scale: React.FC<ScaleProps> = props => {
  const { scaleKey, time } = props;

  const getConfig = () => {
    let config: uPlot.Scale = {
      time: !!time,
      // HACK to enforce axis at 0
      range: (u: any, dataMin: number, dataMax: number) => {
        let [min, max] = uPlot.rangeNum(dataMin, dataMax, 0.2, true);

        return [Math.min(0, min), Math.max(0, max)];
      },
    };
    return config;
  };

  useScaleConfig(scaleKey, getConfig);

  return null;
};

Scale.displayName = 'Scale';
