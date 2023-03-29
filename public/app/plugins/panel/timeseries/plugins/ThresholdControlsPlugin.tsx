import React, { useState, useLayoutEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';

import { FieldConfigSource, ThresholdsConfig, getValueFormat } from '@grafana/data';
import { UPlotConfigBuilder, buildScaleKey } from '@grafana/ui';

import { ThresholdDragHandle } from './ThresholdDragHandle';

const GUTTER_SIZE = 60;

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  fieldConfig: FieldConfigSource;
  onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
}

export const ThresholdControlsPlugin = ({ config, fieldConfig, onThresholdsChange }: ThresholdControlsPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const [renderToken, setRenderToken] = useState(0);

  useLayoutEffect(() => {
    config.setPadding([0, GUTTER_SIZE, 0, 0]);

    config.addHook('init', (u) => {
      plotInstance.current = u;
    });
    // render token required to re-render handles when resizing uPlot
    config.addHook('draw', () => {
      setRenderToken((s) => s + 1);
    });
  }, [config]);

  const thresholdHandles = useMemo(() => {
    const plot = plotInstance.current;

    if (!plot) {
      return null;
    }
    const thresholds = fieldConfig.defaults.thresholds;
    if (!thresholds) {
      return null;
    }
    const scale = buildScaleKey(fieldConfig.defaults);

    const decimals = fieldConfig.defaults.decimals;
    const handles = [];

    for (let i = 0; i < thresholds.steps.length; i++) {
      const step = thresholds.steps[i];
      const yPos = plot.valToPos(step.value, scale);

      if (Number.isNaN(yPos) || !Number.isFinite(yPos)) {
        continue;
      }

      const height = plot.bbox.height / window.devicePixelRatio;

      const isEditable = typeof onThresholdsChange === 'function';

      const onChange = isEditable
        ? (value: number) => {
            const nextSteps = [
              ...thresholds.steps.slice(0, i),
              ...thresholds.steps.slice(i + 1),
              { ...thresholds.steps[i], value },
            ].sort((a, b) => a.value - b.value);

            onThresholdsChange({
              ...thresholds,
              steps: nextSteps,
            });
          }
        : undefined;

      const handle = (
        <ThresholdDragHandle
          key={`${step.value}-${i}`}
          step={step}
          y={yPos}
          dragBounds={{ top: 0, bottom: height }}
          mapPositionToValue={(y) => plot.posToVal(y, scale)}
          formatValue={(v) => getValueFormat(scale)(v, decimals).text}
          onChange={onChange}
        />
      );

      handles.push(handle);
    }

    return handles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderToken, fieldConfig, onThresholdsChange]);

  if (!plotInstance.current) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        overflow: 'visible',
        left: `${(plotInstance.current.bbox.left + plotInstance.current.bbox.width) / window.devicePixelRatio}px`,
        top: `${plotInstance.current.bbox.top / window.devicePixelRatio}px`,
        width: `${GUTTER_SIZE}px`,
        height: `${plotInstance.current.bbox.height / window.devicePixelRatio}px`,
      }}
    >
      {thresholdHandles}
    </div>
  );
};

ThresholdControlsPlugin.displayName = 'ThresholdControlsPlugin';
