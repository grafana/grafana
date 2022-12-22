import { clamp } from 'lodash';
import React, { useLayoutEffect } from 'react';
import uPlot from 'uplot';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

interface KeyboardPluginProps {
  config: UPlotConfigBuilder; // onkeypress, onkeyup, onkeydown (triggered by vizlayout handlers)
}

const PIXELS_PER_MS = 0.1 as const;
const SHIFT_MULTIPLIER = 2 as const;
const KNOWN_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Shift', ' ']);

const initHook = (u: uPlot) => {
  let vizLayoutViz: HTMLElement | null = u.root.closest('[tabindex]');
  let pressedKeys = new Set<string>();
  let dragStartX: number | null = null;
  let keysLastHandledAt: number | null = null;

  if (!vizLayoutViz) {
    return;
  }

  const moveCursor = (dx: number, dy: number) => {
    const { cursor } = u;
    if (cursor.left === undefined || cursor.top === undefined) {
      return;
    }

    const { width, height } = u.over.style;
    const [maxX, maxY] = [Math.floor(parseFloat(width)), Math.floor(parseFloat(height))];

    u.setCursor({
      left: clamp(cursor.left + dx, 0, maxX),
      top: clamp(cursor.top + dy, 0, maxY),
    });
  };

  const handlePressedKeys = (time: number) => {
    const nothingPressed = pressedKeys.size === 0;
    if (nothingPressed || !u) {
      keysLastHandledAt = null;
      return;
    }

    const dt = time - (keysLastHandledAt ?? time);
    const dx = dt * PIXELS_PER_MS;
    let horValue = 0;
    let vertValue = 0;

    if (pressedKeys.has('ArrowUp')) {
      vertValue -= dx;
    }
    if (pressedKeys.has('ArrowDown')) {
      vertValue += dx;
    }
    if (pressedKeys.has('ArrowLeft')) {
      horValue -= dx;
    }
    if (pressedKeys.has('ArrowRight')) {
      horValue += dx;
    }
    if (pressedKeys.has('Shift')) {
      horValue *= SHIFT_MULTIPLIER;
      vertValue *= SHIFT_MULTIPLIER;
    }

    moveCursor(horValue, vertValue);

    const { cursor } = u;
    if (pressedKeys.has(' ') && cursor) {
      const drawHeight = Number(u.over.style.height.slice(0, -2));

      u.setSelect(
        {
          left: cursor.left! < dragStartX! ? cursor.left! : dragStartX!,
          top: 0,
          width: Math.abs(cursor.left! - (dragStartX ?? cursor.left!)),
          height: drawHeight,
        },
        false
      );
    }

    keysLastHandledAt = time;
    window.requestAnimationFrame(handlePressedKeys);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Hide the cursor if the user tabs away
      u.setCursor({ left: -5, top: -5 });
      return;
    }

    if (!KNOWN_KEYS.has(e.key)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const newKey = !pressedKeys.has(e.key);
    if (newKey) {
      const initiateAnimationLoop = pressedKeys.size === 0;
      pressedKeys.add(e.key);

      dragStartX = e.key === ' ' && dragStartX === null ? u.cursor.left! : dragStartX;

      if (initiateAnimationLoop) {
        window.requestAnimationFrame(handlePressedKeys);
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!KNOWN_KEYS.has(e.key)) {
      return;
    }

    pressedKeys.delete(e.key);

    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();

      // We do this so setSelect hooks get fired, zooming the plot
      u.setSelect(u.select);
      dragStartX = null;
    }
  };

  const onFocus = () => {
    // We only want to initialize the cursor if the user is using keyboard controls
    if (!vizLayoutViz?.matches(':focus-visible')) {
      return;
    }

    // Is there a more idiomatic way to do this?
    const drawWidth = parseFloat(u.over.style.width);
    const drawHeight = parseFloat(u.over.style.height);
    u.setCursor({ left: drawWidth / 2, top: drawHeight / 2 });
  };

  const onBlur = () => {
    keysLastHandledAt = null;
    dragStartX = null;
    pressedKeys.clear();
    u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
  };

  vizLayoutViz.addEventListener('keydown', onKeyDown);
  vizLayoutViz.addEventListener('keyup', onKeyUp);
  vizLayoutViz.addEventListener('focus', onFocus);
  vizLayoutViz.addEventListener('blur', onBlur);

  const onDestroy = () => {
    vizLayoutViz?.removeEventListener('keydown', onKeyDown);
    vizLayoutViz?.removeEventListener('keyup', onKeyUp);
    vizLayoutViz?.removeEventListener('focus', onFocus);
    vizLayoutViz?.removeEventListener('blur', onBlur);

    vizLayoutViz = null;
  };

  (u.hooks.destroy ??= []).push(onDestroy);
};

/**
 * @alpha
 */
export const KeyboardPlugin: React.FC<KeyboardPluginProps> = ({ config }) => {
  useLayoutEffect(() => config.addHook('init', initHook), [config]);

  return null;
};
