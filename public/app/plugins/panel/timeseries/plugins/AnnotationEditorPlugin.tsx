import React, { useLayoutEffect, useState, useCallback } from 'react';
import { UPlotConfigBuilder, PlotSelection, usePlotContext, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { CartesianCoords2D, DataFrame, GrafanaTheme2, TimeZone } from '@grafana/data';
import { AnnotationEditor } from './AnnotationEditor';

type StartAnnotatingFn = (props: {
  // pixel coordinates of the clicked point on the uPlot canvas
  coords: { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D } | null;
}) => void;

interface AnnotationEditorPluginProps {
  data: DataFrame;
  timeZone: TimeZone;
  config: UPlotConfigBuilder;
  onAnnotationCreate: () => void;
  children?: (props: { startAnnotating: StartAnnotatingFn }) => React.ReactNode;
}

/**
 * @alpha
 */
export const AnnotationEditorPlugin: React.FC<AnnotationEditorPluginProps> = ({
  onAnnotationCreate,
  data,
  timeZone,
  config,
  children,
}) => {
  const plotCtx = usePlotContext();
  const styles = useStyles2(getStyles);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [selection, setSelection] = useState<PlotSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    const plotInstance = plotCtx.plot;
    if (plotInstance) {
      plotInstance.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    }
  }, [setSelection, plotCtx]);

  useLayoutEffect(() => {
    let annotating = false;

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

    config.setCursor({
      bind: {
        mousedown: (u, targ, handler) => (e) => {
          if (e.button === 0) {
            handler(e);
            if (e.metaKey) {
              annotating = true;
            }
          }

          return null;
        },
        mouseup: (u, targ, handler) => {
          return (e) => {
            if (e.button === 0) {
              if (annotating) {
                let _setSelectHooks;

                // Monkey patch existing setSelect hooks (ZoomPlugin for instance)
                if (u.hooks['setSelect']) {
                  _setSelectHooks = u.hooks['setSelect'];
                  u.hooks['setSelect'] = [setSelect];
                }
                // fire original handler
                handler(e);

                // Bring back setSelect hooks
                u.hooks['setSelect'] = _setSelectHooks;
              } else {
                handler(e);
              }
            }

            return null;
          };
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
        <>
          <div className={styles.backdrop} />
          <AnnotationEditor
            selection={selection}
            onDismiss={clearSelection}
            onSave={() => {
              clearSelection();
              onAnnotationCreate();
            }}
            data={data}
            timeZone={timeZone}
          />
        </>
      )}
      {children ? children({ startAnnotating }) : null}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    backdrop: css`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${theme.zIndex.navbarFixed};
    `,
  };
};
