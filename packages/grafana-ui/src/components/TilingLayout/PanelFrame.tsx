import { memo } from 'react';
import type * as React from 'react';

import { t } from '@grafana/i18n';

import { IconButton } from '../IconButton/IconButton';

import { TilingTab } from './TilingTab';
import { surfaceDomId, tabDomId, useTilingInternals } from './internalContext';
import { type Rect } from './model/types';
import { type TilingPanelInfo, type TilingViewInfo } from './types';

const INTERACTIVE = 'button, a, input, select, textarea, [contenteditable], [data-tiling-no-drag]';

function isInteractiveTarget(e: React.SyntheticEvent, container: Element) {
  const el = e.target instanceof Element ? e.target.closest(INTERACTIVE) : null;
  return el !== null && el !== container && container.contains(el);
}

export interface PanelFrameProps {
  panel: TilingPanelInfo;
  rect: Rect;
  z: number;
  lifted?: boolean;
  /** Pixel shifts of tabs while one is dragged within this strip. */
  reorder?: { viewId: string; offsetX: number; shifts: Record<string, number> };
  /** Space opened in the strip for a tab being dropped here. */
  tabGap?: { index: number; width: number };
}

export const PanelFrame = memo(function PanelFrame({ panel, rect, z, lifted, reorder, tabGap }: PanelFrameProps) {
  const internals = useTilingInternals();
  const { styles, metrics, rootId } = internals;
  const floating = panel.region === 'floating';

  const onTabBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e, e.currentTarget) || (e.target instanceof Element && e.target.closest('[role="tab"]'))) {
      return;
    }
    internals.focusView(panel.selectedView.id);
    internals.onPanelPointerDown(e, panel.id, panel.region);
  };

  const onTabBarDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractiveTarget(e, e.currentTarget)) {
      internals.toggleMaximize(panel.id);
    }
  };

  const onTabBarContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e, e.currentTarget)) {
      return;
    }
    e.preventDefault();
    const tab = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tiling-tab]') : null;
    if (tab?.dataset.tilingTab) {
      internals.selectView(tab.dataset.tilingTab);
    }
    internals.openMenu(panel.id, e.clientX, e.clientY);
  };

  return (
    <div
      className={styles.frame}
      data-tiling-panel={panel.id}
      data-floating={floating || undefined}
      data-lifted={lifted || undefined}
      data-focused={panel.focused || undefined}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: z }}
    >
      <div
        className={styles.tabBar}
        style={{ height: metrics.tabBarHeight }}
        data-tiling-tabbar={panel.id}
        onPointerDown={onTabBarPointerDown}
        onDoubleClick={onTabBarDoubleClick}
        onContextMenu={onTabBarContextMenu}
      >
        <div
          className={styles.tabStrip}
          role="tablist"
          aria-label={panel.selectedView.title}
          data-tiling-tabs={panel.id}
          data-lifted-strip={lifted || undefined}
        >
          {panel.views.map((view, index) => (
            <TabElement
              key={view.id}
              view={view}
              panel={panel}
              index={index}
              shift={
                reorder
                  ? view.id === reorder.viewId
                    ? reorder.offsetX
                    : (reorder.shifts[view.id] ?? 0)
                  : tabGap && index >= tabGap.index
                    ? tabGap.width
                    : 0
              }
              dragging={reorder?.viewId === view.id}
              rootId={rootId}
            />
          ))}
        </div>
        <div className={styles.tabBarActions}>
          {internals.renderTabBarActions?.(panel)}
          <IconButton
            name="ellipsis-h"
            size="sm"
            aria-label={t('grafana-ui.tiling-layout.panel-menu', 'Panel menu')}
            aria-haspopup="menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              internals.openMenu(panel.id, r.left, r.bottom + 4, e.currentTarget);
            }}
          />
        </div>
      </div>
      <div className={styles.frameBody} />
    </div>
  );
});

interface TabElementProps {
  view: TilingViewInfo;
  panel: TilingPanelInfo;
  index: number;
  shift: number;
  dragging: boolean;
  rootId: string;
}

function TabElement({ view, panel, index, shift, dragging, rootId }: TabElementProps) {
  const internals = useTilingInternals();
  const { styles } = internals;
  const selected = panel.selectedView.id === view.id;
  const closable = internals.isViewClosable(view);
  const focused = selected && panel.focused;
  const onClose = () => internals.closeView(view.id);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInteractiveTarget(e, e.currentTarget)) {
      return;
    }
    internals.selectView(view.id);
    internals.focusView(view.id);
    internals.onTabPointerDown(e, panel.id, view.id, panel.region);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const views = panel.views;
    const go = (i: number) => {
      e.preventDefault();
      internals.selectView(views[(i + views.length) % views.length].id, true);
    };
    switch (e.key) {
      case 'ArrowRight':
        return go(index + 1);
      case 'ArrowLeft':
        return go(index - 1);
      case 'Home':
        return go(0);
      case 'End':
        return go(views.length - 1);
      case 'Enter':
      case ' ':
        e.preventDefault();
        internals.focusContent(view.id);
        return;
      case 'Delete':
        if (closable) {
          e.preventDefault();
          onClose();
        }
        return;
      case 'ContextMenu':
      case 'F10':
        if (e.key === 'ContextMenu' || e.shiftKey) {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          internals.openMenu(panel.id, r.left, r.bottom + 4, e.currentTarget);
        }
        return;
    }
  };

  return (
    <div
      role="tab"
      id={tabDomId(rootId, view.id)}
      aria-selected={selected}
      aria-controls={surfaceDomId(rootId, view.id)}
      tabIndex={selected ? 0 : -1}
      className={styles.tab}
      data-tiling-tab={view.id}
      data-focused={focused || undefined}
      data-dragging={dragging || undefined}
      style={shift ? { transform: `translateX(${shift}px)` } : undefined}
      onPointerDown={onPointerDown}
      onMouseDown={(e) => {
        // Keep middle-click from starting autoscroll so it can close the tab instead.
        if (e.button === 1) {
          e.preventDefault();
        }
      }}
      onAuxClick={(e) => {
        if (e.button === 1 && closable) {
          onClose();
        }
      }}
      onKeyDown={onKeyDown}
    >
      {internals.renderTab ? (
        internals.renderTab({ view, panel, selected, focused, closable, onClose })
      ) : (
        <TilingTab
          view={view}
          panel={panel}
          selected={selected}
          focused={focused}
          closable={closable}
          onClose={onClose}
        />
      )}
    </div>
  );
}
