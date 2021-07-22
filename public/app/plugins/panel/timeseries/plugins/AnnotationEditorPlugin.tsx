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
  }, [setSelection, , setIsAddingAnnotation, plotCtx]);

  useLayoutEffect(() => {
    let annotating = false;
    let isClick = false;

    const setSelect = (u: uPlot) => {
      if (annotating) {
        setIsAddingAnnotation(true);
        const min = u.posToVal(u.select.left, 'x');
        const max = u.posToVal(u.select.left + u.select.width, 'x');

        setSelection({
          min,
          max,
          bbox: {
            left: u.select.left,
            top: 0,
            height: u.bbox.height / window.devicePixelRatio,
            width: u.select.width,
          },
        });
        annotating = false;
      }
    };

    config.addHook('setSelect', setSelect);

    config.addHook('init', (u) => {
      // Wrap all setSelect hooks to prevent them from firing if user is annotating
      const setSelectHooks = u.hooks['setSelect'];
      if (setSelectHooks) {
        for (let i = 0; i < setSelectHooks.length; i++) {
          const hook = setSelectHooks[i];
          if (hook === setSelect) {
            continue;
          }

          setSelectHooks[i] = (...args) => {
            if (!annotating) {
              hook!(...args);
            }
          };
        }
      }
    });

    config.setCursor({
      bind: {
        mousedown: (u, targ, handler) => (e) => {
          if (e.button === 0) {
            handler(e);
            if (e.metaKey) {
              isClick = true;
              annotating = true;
            }
          }

          return null;
        },
        mousemove: (u, targ, handler) => (e) => {
          if (e.button === 0) {
            handler(e);
            // handle cmd+drag
            if (e.metaKey) {
              isClick = false;
              annotating = true;
            }
          }

          return null;
        },
        mouseup: (u, targ, handler) => (e) => {
          // handle cmd+click
          if (isClick && u.cursor.left && e.button === 0 && e.metaKey) {
            u.setSelect({ left: u.cursor.left, width: 0, top: 0, height: 0 });
            annotating = true;
          }
          handler(e);
          return null;
        },
      },
    });
  }, [config, setIsAddingAnnotation]);

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
    [plotCtx, setSelection, setIsAddingAnnotation]
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
