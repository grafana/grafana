import React, { useState, useLayoutEffect, useMemo } from 'react';
import { css } from '@emotion/css';
import { FieldConfigSource, ThresholdsConfig, getValueFormat } from '@grafana/data';
import { UPlotConfigBuilder, usePlotContext, FIXED_UNIT } from '@grafana/ui';
import { ThresholdDragHandle } from './ThresholdDragHandle';

const GUTTER_SIZE = 60;

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  fieldConfig: FieldConfigSource;
  onThresholdsChange: (thresholds: ThresholdsConfig) => void;
}

export const ThresholdControlsPlugin: React.FC<ThresholdControlsPluginProps> = ({
  config,
  fieldConfig,
  onThresholdsChange,
}) => {
  const plotCtx = usePlotContext();
  const plotInstance = plotCtx.plot;
  const [renderToken, setRenderToken] = useState(0);

  useLayoutEffect(() => {
    config.setPadding([0, GUTTER_SIZE, 0, 0]);
    // render token required to re-render handles when resizing uPlot
    config.addHook('draw', () => {
      setRenderToken((s) => s + 1);
    });
  }, [config]);

  const className = useMemo(() => {
    if (!plotInstance) {
      return;
    }
    return css`
      position: absolute;
      overflow: visible;
      left: ${(plotInstance.bbox.left + plotInstance.bbox.width) / window.devicePixelRatio}px;
      top: ${plotInstance.bbox.top / window.devicePixelRatio}px;
      width: ${GUTTER_SIZE}px;
      height: ${plotInstance.bbox.height / window.devicePixelRatio}px;
    `;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotInstance, renderToken]);

  const thresholdHandles = useMemo(() => {
    if (!plotInstance) {
      return null;
    }

    const thresholds = fieldConfig.defaults.thresholds;
    if (!thresholds) {
      return null;
    }

    const scale = fieldConfig.defaults.unit ?? FIXED_UNIT;
    const decimals = fieldConfig.defaults.decimals;
    const handles = [];

    for (let i = 0; i < thresholds.steps.length; i++) {
      const step = thresholds.steps[i];
      const yPos = plotInstance.valToPos(step.value, scale);

      if (Number.isNaN(yPos) || !Number.isFinite(yPos)) {
        continue;
      }

      const handle = (
        <ThresholdDragHandle
          step={step}
          y={yPos}
          dragBounds={{ top: 0, bottom: plotInstance.bbox.height / window.devicePixelRatio }}
          mapPositionToValue={(y) => plotInstance.posToVal(y, scale)}
          formatValue={(v) => getValueFormat(scale)(v, decimals).text}
          onChange={(value) => {
            const nextSteps = [
              ...thresholds.steps.slice(0, i),
              ...thresholds.steps.slice(i + 1),
              { ...thresholds.steps[i], value },
            ].sort((a, b) => a.value - b.value);

            onThresholdsChange({
              ...thresholds,
              steps: nextSteps,
            });
          }}
        />
      );
      handles.push(handle);
    }

    return handles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotInstance, renderToken, fieldConfig, onThresholdsChange]);

  if (!plotInstance) {
    return null;
  }
  return <div className={className}>{thresholdHandles}</div>;
};

ThresholdControlsPlugin.displayName = 'ThresholdControlsPlugin';
