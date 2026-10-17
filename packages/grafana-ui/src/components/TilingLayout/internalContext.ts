import type * as React from 'react';
import { createContext, useContext } from 'react';

import { type LayoutMetrics, type PanelRegion } from './model/types';
import { type TilingStyles } from './styles';
import { type TilingPanelInfo, type TilingTabRenderProps, type TilingViewInfo } from './types';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Stable handlers and render props shared by the layout's parts. */
export interface TilingInternals {
  rootId: string;
  styles: TilingStyles;
  metrics: LayoutMetrics;
  maximizeEnabled: boolean;
  renderTab?: (props: TilingTabRenderProps) => React.ReactNode;
  renderTabBarActions?: (panel: TilingPanelInfo) => React.ReactNode;
  isViewClosable: (view: TilingViewInfo) => boolean;
  onTabPointerDown: (e: React.PointerEvent, panelId: string, viewId: string, region: PanelRegion) => void;
  onPanelPointerDown: (e: React.PointerEvent, panelId: string, region: PanelRegion) => void;
  onFloatResizeStart: (e: React.PointerEvent, panelId: string, dir: ResizeDirection) => void;
  selectView: (viewId: string, focusTab?: boolean) => void;
  focusView: (viewId: string) => void;
  focusContent: (viewId: string) => void;
  closeView: (viewId: string) => void;
  toggleMaximize: (panelId: string) => void;
  openMenu: (panelId: string, x: number, y: number, anchor?: HTMLElement) => void;
}

export const TilingInternalContext = createContext<TilingInternals | null>(null);

export function useTilingInternals(): TilingInternals {
  const ctx = useContext(TilingInternalContext);
  if (!ctx) {
    throw new Error('Tiling layout parts must render inside <TilingLayout>');
  }
  return ctx;
}

export function tabDomId(rootId: string, viewId: string) {
  return `${rootId}-tab-${viewId}`;
}

export function surfaceDomId(rootId: string, viewId: string) {
  return `${rootId}-view-${viewId}`;
}
