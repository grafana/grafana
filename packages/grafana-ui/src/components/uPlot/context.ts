import React, { useCallback, useContext } from 'react';
import uPlot from 'uplot';
import { PlotPlugin } from './types';
import { DataFrame, Field, FieldConfig } from '@grafana/data';

interface PlotCanvasContextType {
  // canvas size css pxs
  width: number;
  height: number;
  // plotting area bbox, css pxs
  plot: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

interface PlotContextType {
  u: uPlot;
  series: uPlot.Series;
  canvas: PlotCanvasContextType;
}

interface PlotDataContextType {
  data: DataFrame;
}

type PlotPluginsContextType = {
  registerPlugin: (plugin: PlotPlugin) => () => void;
};

export const PlotContext = React.createContext<PlotContextType | null>(null);
export const PlotPluginsContext = React.createContext<PlotPluginsContextType>(null);
export const PlotDataContext = React.createContext<PlotDataContextType | null>(null);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType | null => {
  return useContext<PlotContextType>(PlotContext);
};

// Exposes API for registering uPlot plugins
export const usePlotPluginContext = (): PlotPluginsContextType => {
  return useContext(PlotPluginsContext);
};

interface PlotDataAPI {
  /** Data frame passed to graph, x-axis aligned */
  data: DataFrame;
  /** Returns field by index */
  getField: (idx: number) => Field;
  /** Returns x-axis fields */
  getXAxisFields: () => Field[];
  /** Returns x-axis fields */
  getYAxisFields: () => Field[];
  /** Returns field value by field and value index */
  getFieldValue: (fieldIdx: number, rowIdx: number) => any;
  /** Returns field config by field index */
  getFieldConfig: (fieldIdx: number) => FieldConfig;
}

export const usePlotData = (): PlotDataAPI => {
  const ctx = useContext(PlotDataContext);

  const getField = useCallback(
    (idx: number) => {
      return ctx.data.fields[idx];
    },
    [ctx.data]
  );

  const getFieldConfig = useCallback(
    (idx: number) => {
      const field: Field = getField(idx);
      return field.config;
    },
    [ctx.data]
  );

  const getFieldValue = useCallback(
    (fieldIdx: number, rowIdx: number) => {
      const field: Field = getField(fieldIdx);
      return field.values.get(rowIdx);
    },
    [ctx.data]
  );

  const getXAxisFields = useCallback(() => {
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return [getField(0)];
  }, [ctx.data]);

  const getYAxisFields = useCallback(() => {
    if (!ctx) {
      throw new Error('usePlotData needs to be used within PlotDataContext');
    }
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return ctx.data.fields.slice(1);
  }, [ctx.data]);

  if (!ctx) {
    throw new Error('usePlotData needs to be used within PlotDataContext');
  }

  return {
    data: ctx.data,
    getField,
    getFieldValue,
    getFieldConfig,
    getXAxisFields,
    getYAxisFields,
  };
};

// Returns bbox of the plot canvas (only the graph, no axes)
export const usePlotCanvas = (): PlotCanvasContextType | null => {
  const ctx = usePlotContext();
  return ctx?.canvas;
};

export const buildPlotContext = (u?: uPlot): PlotContextType | null => {
  if (!u) {
    return null;
  }

  return {
    u,
    series: u.series,
    canvas: {
      width: u.width,
      height: u.height,
      plot: {
        width: u.bbox.width / window.devicePixelRatio,
        height: u.bbox.height / window.devicePixelRatio,
        top: u.bbox.top / window.devicePixelRatio,
        left: u.bbox.left / window.devicePixelRatio,
      },
    },
  };
};
