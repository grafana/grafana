import 'json-diff-kit/dist/viewer.css';
import { Viewer, Differ } from 'json-diff-kit';
import { useEffect, useMemo, useRef } from 'react';

import type { CanvasEventArray } from '../types.ts';

import { ToggleCanvasContextButton } from './CanvasContextToggleButton.tsx';

interface DiffCanvasProps {
  width: number;
  height: number;
  hasDiff: boolean;
  diffImageData: ImageData | null;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  renderDiffSetupEvents: boolean;
  onToggleDiffSetupEvents: () => void;
  expected?: CanvasEventArray;
  actual?: CanvasEventArray;
}

export function CanvasDiff({
  width,
  height,
  hasDiff,
  diffImageData,
  showOverlay,
  onToggleOverlay,
  renderDiffSetupEvents,
  onToggleDiffSetupEvents,
  expected,
  actual,
}: DiffCanvasProps) {
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const differ = useMemo(
    () =>
      new Differ({
        detectCircular: true,
        maxDepth: Infinity,
        showModifications: true,
        arrayDiffMethod: 'lcs',
      }),
    []
  );

  const diff = useMemo(() => differ.diff(expected, actual), [differ, expected, actual]);

  useEffect(() => {
    const diffContext = diffCanvasRef.current?.getContext('2d');
    if (!diffContext) {
      return;
    }
    diffContext.clearRect(0, 0, width, height);
    if (diffImageData) {
      diffContext.putImageData(diffImageData, 0, 0);
    }
  }, [diffImageData, height, width]);

  if (!hasDiff) {
    return (
      <div className="plot-panel diff diff-empty">
        <div className="plot-header">
          <div className={'plot-label'}>Diff</div>
        </div>
        <Viewer diff={diff} />
      </div>
    );
  }

  return (
    <div className="plot-panel diff">
      <div className="plot-header">
        <div className={'plot-label'}>Diff</div>
        <div className="plot-actions">
          <ToggleCanvasContextButton onClick={onToggleDiffSetupEvents} showCanvasContext={renderDiffSetupEvents} />
          <button className="overlay-toggle-btn" type="button" onClick={onToggleOverlay}>
            {showOverlay ? 'Hide overlay' : 'Overlay on charts'}
          </button>
        </div>
      </div>
      <canvas ref={diffCanvasRef} className="canvas" id="diff" width={width} height={height}></canvas>
    </div>
  );
}
