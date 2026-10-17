import { memo } from 'react';

import { TilingViewContext } from './context';
import { surfaceDomId, tabDomId, useTilingInternals } from './internalContext';
import { type Rect } from './model/types';
import { type RenderView, type TilingViewApi, type TilingViewInfo } from './types';

export interface ViewSurfaceProps {
  view: TilingViewApi;
  rect: Rect;
  z: number;
  visible: boolean;
  lifted: boolean;
  /** Content ignores the pointer, e.g. while dragging, so iframes and canvases don't swallow it. */
  inert: boolean;
  renderView: RenderView;
}

/**
 * Hosts a view's content. Surfaces are rendered in a flat, stable list next to the panel frames and only
 * repositioned, so content never remounts when a view is docked, tabbed, floated or maximized.
 */
export const ViewSurface = memo(function ViewSurface({
  view,
  rect,
  z,
  visible,
  lifted,
  inert,
  renderView,
}: ViewSurfaceProps) {
  const { styles, rootId } = useTilingInternals();
  return (
    <div
      className={styles.surface}
      role="tabpanel"
      id={surfaceDomId(rootId, view.id)}
      aria-labelledby={tabDomId(rootId, view.id)}
      data-tiling-view={view.id}
      data-lifted={lifted || undefined}
      data-inert={inert || undefined}
      inert={!visible}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex: z,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <TilingViewContext.Provider value={view}>
        <ViewContent view={view} renderView={renderView} className={styles.surfaceContent} />
      </TilingViewContext.Provider>
    </div>
  );
});

const ViewContent = memo(function ViewContent({
  view,
  renderView,
  className,
}: {
  view: TilingViewInfo;
  renderView: RenderView;
  className: string;
}) {
  return <div className={className}>{renderView(view)}</div>;
});
