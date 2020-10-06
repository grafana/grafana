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

interface PlotConfigContextType {
  addSeries: (
    series: uPlot.Series
  ) => {
    removeSeries: () => void;
    updateSeries: () => void;
  };
  addScale: (
    scaleKey: string,
    scale: uPlot.Scale
  ) => {
    removeScale: () => void;
    updateScale: () => void;
  };
  addAxis: (
    axis: uPlot.Axis
  ) => {
    removeAxis: () => void;
    updateAxis: () => void;
  };
}

interface PlotPluginsContextType {
  registerPlugin: (plugin: PlotPlugin) => () => void;
}

interface PlotContextType extends PlotConfigContextType, PlotPluginsContextType {
  u?: uPlot;
  series?: uPlot.Series[];
  canvas?: PlotCanvasContextType;
  canvasRef: any;
  data: DataFrame;
}

export const PlotContext = React.createContext<PlotContextType | null>(null);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType | null => {
  return useContext<PlotContextType | null>(PlotContext);
};

const throwWhenNoContext = (name: string) => {
  throw new Error(`${name} must be used within PlotContext`);
};

// Exposes API for registering uPlot plugins
export const usePlotPluginContext = (): PlotPluginsContextType => {
  const ctx = useContext(PlotContext);
  if (!ctx) {
    throwWhenNoContext('usePlotPluginContext');
  }
  return {
    registerPlugin: ctx!.registerPlugin,
  };
};

// Exposes API for building uPlot config
export const usePlotConfigContext = (): PlotConfigContextType => {
  const ctx = useContext(PlotContext);
  if (!ctx) {
    throwWhenNoContext('usePlotPluginContext');
  }
  return {
    addSeries: ctx!.addSeries,
    addAxis: ctx!.addAxis,
    addScale: ctx!.addScale,
  };
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
  const ctx = useContext(PlotContext);

  const getField = useCallback(
    (idx: number) => {
      if (!ctx) {
        throwWhenNoContext('usePlotData');
      }
      return ctx!.data.fields[idx];
    },
    [ctx]
  );

  const getFieldConfig = useCallback(
    (idx: number) => {
      const field: Field = getField(idx);
      return field.config;
    },
    [ctx]
  );

  const getFieldValue = useCallback(
    (fieldIdx: number, rowIdx: number) => {
      const field: Field = getField(fieldIdx);
      return field.values.get(rowIdx);
    },
    [ctx]
  );

  const getXAxisFields = useCallback(() => {
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return [getField(0)];
  }, [ctx]);

  const getYAxisFields = useCallback(() => {
    if (!ctx) {
      throwWhenNoContext('usePlotData');
    }
    // by uPlot convention x-axis is always first field
    // this may change when we introduce non-time x-axis and multiple x-axes (https://leeoniya.github.io/uPlot/demos/time-periods.html)
    return ctx!.data.fields.slice(1);
  }, [ctx]);

  if (!ctx) {
    throwWhenNoContext('usePlotData');
  }

  return {
    data: ctx!.data,
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
  if (!ctx) {
    throwWhenNoContext('usePlotCanvas');
  }

  return ctx!.canvas || null;
};

export const buildPlotContext = (
  registerPlugin: any,
  addSeries: any,
  addAxis: any,
  addScale: any,
  canvasRef: any,
  data: DataFrame,
  u?: uPlot
): PlotContextType | null => {
  return {
    u,
    series: u?.series,
    canvas: u
      ? {
          width: u.width,
          height: u.height,
          plot: {
            width: u.bbox.width / window.devicePixelRatio,
            height: u.bbox.height / window.devicePixelRatio,
            top: u.bbox.top / window.devicePixelRatio,
            left: u.bbox.left / window.devicePixelRatio,
          },
        }
      : undefined,
    registerPlugin,
    addSeries,
    addAxis,
    addScale,
    canvasRef,
    data,
  };
};
