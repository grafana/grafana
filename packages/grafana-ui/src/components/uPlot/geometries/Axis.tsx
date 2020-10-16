import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AxisProps } from './types';
import { usePlotConfigContext, usePlotContext } from '../context';
import { useTheme } from '../../../themes';
import uPlot from 'uplot';
import { Field } from '@grafana/data';

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
  const size = useAxisSize(props);

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
      size,
      stroke,
      side,
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
Axis.displayName = 'Axis';

const lineHeight = 25;

const useAxisSize = (props: AxisProps): number => {
  const { isPlotReady, getPlotInstance } = usePlotContext();
  let size = 0;

  if (!isPlotReady) {
    return 0;
  }

  if (props.label && props.label.length > 0) {
    size += lineHeight * 2;
  }

  const valueExtras = displaySettings(props.field);
  const measure = getPlotInstance().ctx.measureText(valueExtras);

  switch (props.side ?? 3) {
    case 2:
      return size + lineHeight * 2;
    default:
      return size + measure.width;
  }
};

const displaySettings = (field?: Field): string => {
  if (!field || !field.display) {
    return '';
  }
  const settings = field.display(field.config.max ?? '');
  return `${settings.prefix ?? ''} ${settings.suffix ?? ''}`;
};
