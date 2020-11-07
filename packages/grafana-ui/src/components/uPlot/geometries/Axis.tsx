import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AxisProps } from './types';
import { usePlotConfigContext } from '../context';
import { useTheme } from '../../../themes';
import uPlot from 'uplot';
import { measureText } from '../../../utils';

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
  const gridColor = useMemo(() => (theme.isDark ? theme.palette.gray1 : theme.palette.gray4), [theme]);
  const {
    scaleKey,
    label,
    show = true,
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
      stroke,
      side,
      size: calculateAxisSize,
      grid: {
        show: grid,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      ticks: {
        show: true,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      values: values ? values : formatValue ? (u: uPlot, vals: any[]) => vals.map(v => formatValue(v)) : undefined,
    };

    return config;
  };

  useAxisConfig(getConfig);
  return null;
};

function calculateAxisSize(self: uPlot, values: string[], axisIdx: number) {
  const axis = self.axes[axisIdx];
  if (axis.scale === 'x') {
    return 54;
  }

  if (values === null || !values.length) {
    return 0;
  }

  let maxLength = values[0];
  for (let i = 0; i < values.length; i++) {
    if (values[i].length > maxLength.length) {
      maxLength = maxLength;
    }
  }

  return measureText(maxLength, 12).width;
}

Axis.displayName = 'Axis';
