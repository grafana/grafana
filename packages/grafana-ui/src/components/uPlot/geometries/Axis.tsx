import React, { useCallback, useEffect, useRef } from 'react';
import { AxisProps } from './types';
import { usePlotConfigContext } from '../context';
import { useTheme } from '../../../themes';
import uPlot from 'uplot';

export const useAxisConfig = (getConfig: () => any) => {
  const { addAxis } = usePlotConfigContext();
  const updateConfigRef = useRef<(c: uPlot.Axis) => void>(() => {});

  const defaultAxisConfig: uPlot.Axis = {};

  const getUpdateConfigRef = useCallback(() => {
    return updateConfigRef.current;
  }, [updateConfigRef]);

  useEffect(() => {
    const config = getConfig();
    const { removeAxis, updateAxis } = addAxis({ ...defaultAxisConfig, ...config });
    updateConfigRef.current = updateAxis;
    return () => {
      removeAxis();
    };
  }, []);

  // update series config when config getter is updated
  useEffect(() => {
    const config = getConfig();
    getUpdateConfigRef()({ ...defaultAxisConfig, ...config });
  }, [getConfig]);
};

export const Axis: React.FC<AxisProps> = props => {
  const theme = useTheme();
  const {
    scaleKey,
    label,
    show = true,
    size = 80,
    stroke = theme.colors.text,
    side = 3,
    grid = true,
    formatValue,
    values,
  } = props;

  const getConfig = () => {
    let config: uPlot.Axis = {
      scale: scaleKey,
      label,
      show,
      size,
      stroke,
      side,
      grid: {
        show: grid,
        stroke: theme.palette.gray4,
        width: 1 / devicePixelRatio,
      },
      values: values ? values : formatValue ? (u: uPlot, vals: any[]) => vals.map(v => formatValue(v)) : undefined,
    };

    return config;
  };
  useAxisConfig(getConfig);

  return null;
};
Axis.displayName = 'Axis';
