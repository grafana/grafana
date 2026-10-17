import { type ReactNode } from 'react';

import { type IconName } from '../../types/icon';

import { type OpenPlacement } from './model/document';
import { type LayoutDocument, type PanelRegion, type Rect, type ViewParams, type ViewRecord } from './model/types';

export interface TilingViewInfo<P extends object = ViewParams> {
  id: string;
  title: string;
  type?: string;
  params: P;
  panelId: string | null;
  region: PanelRegion | null;
  /** The view is the selected tab of its panel. */
  selected: boolean;
  /** The view has focus within the layout. */
  focused: boolean;
}

export interface TilingPanelInfo {
  id: string;
  region: PanelRegion;
  views: TilingViewInfo[];
  selectedView: TilingViewInfo;
  /** The panel holds the focused view. */
  focused: boolean;
  maximized: boolean;
}

export interface TilingTabRenderProps {
  view: TilingViewInfo;
  panel: TilingPanelInfo;
  selected: boolean;
  focused: boolean;
  closable: boolean;
  onClose: () => void;
}

export interface TilingMenuItem {
  id?: string;
  label: string;
  icon?: IconName;
  /** A hint such as "⌘⇧↩". It doesn't bind the key. */
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  /** A submenu. */
  items?: TilingMenuEntry[];
}

export type TilingMenuEntry = TilingMenuItem | 'divider';

export interface TilingPanelMenuRenderProps {
  panel: TilingPanelInfo;
  /** The final entries, after `getPanelMenu`. */
  entries: TilingMenuEntry[];
  close: () => void;
}

export interface TilingLayoutApi {
  getDocument: () => LayoutDocument;
  /** Applies a change to the document. */
  update: (fn: (doc: LayoutDocument) => LayoutDocument) => void;
  openView: (id: string, record: ViewRecord, placement?: OpenPlacement) => void;
  /** Closes a view, consulting `onBeforeViewClose` unless forced. Resolves to whether it closed. */
  closeView: (id: string, options?: { force?: boolean }) => Promise<boolean>;
  selectView: (id: string) => void;
  focusView: (id: string) => void;
  /** Floats a panel (or a single view out of its panel). `rect` is in fractions of the layout. */
  floatPanel: (id: string, rect?: Rect) => void;
  dockPanel: (panelId: string) => void;
  hide: (id: string) => void;
  restore: (panelId: string) => void;
  /** Maximizes a panel (by panel or view id), or restores the previous framing. Returns false when it can't. */
  toggleMaximize: (id?: string) => boolean;
  /** Steps the maximized framing out one level. */
  stepOut: () => void;
  setViewTitle: (id: string, title: string) => void;
  setViewParams: (id: string, params: ViewParams) => void;
}

export interface TilingLayoutState {
  document: LayoutDocument;
  focusedViewId: string | null;
  /** Id of the maximized (framed) node, or null for the whole layout. */
  maximizedId: string | null;
}

export type TilingLayoutContextValue = TilingLayoutApi & TilingLayoutState;

export interface TilingViewApi<P extends object = ViewParams> extends TilingViewInfo<P> {
  close: () => Promise<boolean>;
  hide: () => void;
  focus: () => void;
  setTitle: (title: string) => void;
  setParams: (params: P) => void;
  toggleMaximize: () => boolean;
}

export type RenderView = (view: TilingViewInfo) => ReactNode;
