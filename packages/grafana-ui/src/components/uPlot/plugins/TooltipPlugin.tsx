import React from 'react';
import { css } from 'emotion';
import { Portal } from '../../Portal/Portal';
import { usePlotCanvas } from '../context';
import { CursorPlugin } from './CursorPlugin';
import { pluginLog } from '../utils';

export const TooltipPlugin = () => {
  const pluginId = 'PlotTooltip';
  const plotCanvas = usePlotCanvas();

  if (!plotCanvas) {
    return null;
  }

  return (
    <CursorPlugin id={pluginId}>
      {({ focusedSeriesIdx, focusedPointIdx, coords }) => {
        pluginLog(pluginId, true, 'coords', coords);
        return (
          <Portal>
            {/* TODO wrap in popper, rel to virtual reference element */}
            <div
              className={css`
                position: absolute;
                // rendering in Portal, hence using viewport coords
                top: ${coords.viewport.y + 10}px;
                left: ${coords.viewport.x + 10}px;
                padding: 10px;
                background: red;
              `}
            >
              Focused series idx: ${focusedSeriesIdx}
              <br />
              Focused point idx: ${focusedPointIdx}
            </div>
          </Portal>
        );
      }}
    </CursorPlugin>
  );
};
