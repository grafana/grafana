import type { CSSProperties } from 'react';

import { ToggleCanvasContextButton } from './CanvasContextToggleButton.tsx';
import { OverlayBlendSelect } from './CanvasDiffOverlaySelect.tsx';

export function CanvasHeader(props: {
  onClick: () => void;
  showCanvasContext: boolean;
  showBlend: boolean;
  mixBlendMode: CSSProperties['mixBlendMode'];
  onChangeBlendMode: (mode: CSSProperties['mixBlendMode']) => void;
  title: string;
  hasCanvasContext: boolean;
}) {
  return (
    <div className="plot-header">
      <div className={'plot-label'}>{props.title}</div>
      <div className={'plot-action-wrap'}>
        {props.hasCanvasContext && (
          <ToggleCanvasContextButton onClick={props.onClick} showCanvasContext={props.showCanvasContext} />
        )}
        {props.showBlend ? <OverlayBlendSelect value={props.mixBlendMode} onChange={props.onChangeBlendMode} /> : null}
      </div>
    </div>
  );
}
