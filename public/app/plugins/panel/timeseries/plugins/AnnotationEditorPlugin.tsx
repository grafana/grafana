import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import uPlot from 'uplot';

import { CartesianCoords2D, DataFrame, TimeZone } from '@grafana/data';
import { PlotSelection, UPlotConfigBuilder } from '@grafana/ui';

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
export const AnnotationEditorPlugin = ({ data, timeZone, config, children }: AnnotationEditorPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const [bbox, setBbox] = useState<DOMRect>();
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [selection, setSelection] = useState<PlotSelection | null>(null);
  const isMounted = useMountedState();

  const clearSelection = useCallback(() => {
    setSelection(null);

    if (plotInstance.current) {
      plotInstance.current.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    }
    setIsAddingAnnotation(false);
  }, [setIsAddingAnnotation, setSelection]);

  useLayoutEffect(() => {
    let annotating = false;

    config.addHook('init', (u) => {
      plotInstance.current = u;
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

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => {
      if (!isMounted()) {
        return;
      }
      setBbox(rect);
    });

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
  }, [config, setBbox, isMounted]);

  const startAnnotating = useCallback<StartAnnotatingFn>(
    ({ coords }) => {
      if (!plotInstance.current || !bbox || !coords) {
        return;
      }

      const min = plotInstance.current.posToVal(coords.plotCanvas.x, 'x');

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
    [bbox]
  );

  return (
    <>
      {isAddingAnnotation && selection && bbox && (
        <AnnotationEditor
          selection={selection}
          onDismiss={clearSelection}
          onSave={clearSelection}
          data={data}
          timeZone={timeZone}
          style={{
            position: 'absolute',
            top: `${bbox.top}px`,
            left: `${bbox.left}px`,
            width: `${bbox.width}px`,
            height: `${bbox.height}px`,
          }}
        />
      )}
      {children ? children({ startAnnotating }) : null}
    </>
  );
};
