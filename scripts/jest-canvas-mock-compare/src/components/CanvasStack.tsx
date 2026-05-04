import type { CSSProperties, RefObject } from 'react';

export function CanvasStack(props: {
  uPlotRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  showOverlay: boolean;
  hasDiff: boolean;
  mixBlendMode: CSSProperties['mixBlendMode'];
}) {
  return (
    <div className="canvas-stack">
      <canvas ref={props.uPlotRef} className="canvas" width={props.width} height={props.height} />
      <canvas
        ref={props.overlayRef}
        className={`canvas diff-overlay-canvas${props.showOverlay && props.hasDiff ? ' is-visible' : ''}`}
        width={props.width}
        height={props.height}
        style={{ mixBlendMode: props.mixBlendMode }}
      />
    </div>
  );
}
