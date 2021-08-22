import React, { useLayoutEffect, useState, useCallback } from 'react';

import { UPlotConfigBuilder, PlotSelection, usePlotContext } from '@grafana/ui';
import { CartesianCoords2D, DataFrame, TimeZone } from '@grafana/data';
import { AnnotationEditor } from './annotations/AnnotationEditor';

type StartAnnotatingFn = (props: {
  // pixel coordinates of the clicked point on the uPlot canvas
  coords: { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D } | null;
}) => void;

interface AnnotationEditorPluginProps {
  data: DataFrame;
  timeZone: TimeZone;
  config: UPlotConfigBuilder;
  children?: (props: { startAnnotating: StartAnnotatingFn }) => React.ReactNode;
}

/**
 * @alpha
 */
export const AnnotationEditorPlugin: React.FC<AnnotationEditorPluginProps> = ({ data, timeZone, config, children }) => {
  const plotCtx = usePlotContext();
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [selection, setSelection] = useState<PlotSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    const plotInstance = plotCtx.plot;
    if (plotInstance) {
      plotInstance.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    }
    setIsAddingAnnotation(false);
  }, [plotCtx]);

  useLayoutEffect(() => {
    let annotating = false;

    const setSelect = (u: uPlot) => {
      if (annotating) {
        setIsAddingAnnotation(true);
        setSelection({
          min: u.posToVal(u.select.left, 'x'),
          max: u.posToVal(u.select.left + u.select.width, 'x'),
          bbox: {
            left: u.select.left,
            top: 0,
            height: u.select.height,
            width: u.select.width,
          },
        });
        annotating = false;
      }
    };

    config.addHook('setSelect', setSelect);

    config.addHook('init', (u) => {
      // Wrap all setSelect hooks to prevent them from firing if user is annotating
      const setSelectHooks = u.hooks.setSelect;

      if (setSelectHooks) {
        for (let i = 0; i < setSelectHooks.length; i++) {
          const hook = setSelectHooks[i];

          if (hook !== setSelect) {
            setSelectHooks[i] = (...args) => {
              !annotating && hook!(...args);
            };
          }
        }
      }
    });

    config.setCursor({
      bind: {
        mousedown: (u, targ, handler) => (e) => {
          annotating = e.button === 0 && (e.metaKey || e.ctrlKey);
          handler(e);
          return null;
        },
        mouseup: (u, targ, handler) => (e) => {
          // uPlot will not fire setSelect hooks for 0-width && 0-height selections
          // so we force it to fire on single-point clicks by mutating left & height
          if (annotating && u.select.width === 0) {
            u.select.left = u.cursor.left!;
            u.select.height = u.bbox.height / window.devicePixelRatio;
          }
          handler(e);
          return null;
        },
      },
    });
  }, [config]);

  const startAnnotating = useCallback<StartAnnotatingFn>(
    ({ coords }) => {
      if (!plotCtx || !plotCtx.plot || !coords) {
        return;
      }

      const bbox = plotCtx.getCanvasBoundingBox();

      if (!bbox) {
        return;
      }

      const min = plotCtx.plot.posToVal(coords.plotCanvas.x, 'x');

      if (!min) {
        return;
      }

      setSelection({
        min,
        max: min,
        bbox: {
          left: coords.plotCanvas.x,
          top: 0,
          height: bbox.height,
          width: 0,
        },
      });
      setIsAddingAnnotation(true);
    },
    [plotCtx]
  );

  return (
    <>
      {isAddingAnnotation && selection && (
        <AnnotationEditor
          selection={selection}
          onDismiss={clearSelection}
          onSave={clearSelection}
          data={data}
          timeZone={timeZone}
        />
      )}
      {children ? children({ startAnnotating }) : null}
    </>
  );
};
