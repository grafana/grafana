import { type ReactNode } from 'react';

export interface CmdkSource {
  /**
   * Returns items matching the query. Filtering happens only inside the source, which decides whether to do it on
   * the frontend or the backend. Debouncing is also the source's responsibility. The abortSignal fires when the
   * query changes or the palette closes, at which point the result is discarded.
   */
  query(query: string, abortSignal: AbortSignal): Promise<CmdkItem[]>;

  // The sections provided do not have to be unique. That way multiple sources can for example provide dashboard
  // items in dashboards section.
  providedSections: CmdkSection[];

  // Used in subscope stack to show it to the user in the input field.
  subscopeName?: string;
}

export type CmdkSection = {
  title: string;
  id: string;
};

export type CmdkItem = CmdkItemAction | CmdkItemNavigation | CmdkItemSubscope;

export interface CmdkItemBase {
  // Unique id, used for React keys, focus tracking across re-queries and deduping.
  id: string;

  // Source can return items with different sections.
  sectionId: string;
  title: string;
  // Higher priority sorts first within a section.
  priority: number;

  // smaller text to the right of the title, usually used for parent folder
  rightSubtitle?: string;

  // list of tags, for example dashboard tags when showing a dashboard
  tags?: string[];
  // a smaller text under the title
  subtitle?: string;
  // additional small text items that will be displayed next to a subtitle in single line.
  subtitleItems?: string[];

  // actions that can be performed on the item. They will be shown as pills on the right edge of the item. These
  // will be executed if the shortcut is pressed when focus is on the item.
  additionalActions?: CmdkAction[];

  // A component that will be rendered as a detail of the item in the right hand side of the split view when the
  // item is focused.
  renderDetail?: () => ReactNode;
}

export interface CmdkItemAction extends CmdkItemBase {
  type: 'action';

  // Action to be performed when the item is selected.
  action: () => void;
}

export interface CmdkItemNavigation extends CmdkItemBase {
  type: 'navigation';

  // Selecting this item will navigate to the href.
  href: string;
}

// This type of item will allow scoping the items and diving deeper into a section allowing for faceted UI in the
// cmdk.
export interface CmdkItemSubscope extends CmdkItemBase {
  type: 'subscope';

  // This will return a source that will be added to the subscope stack of the cmdk.
  getScope: () => CmdkSource;
}

export interface CmdkAction {
  title: string;
  // Keyboard shortcut like 'mod+d' or 'shift+enter'.
  shortcut: string;

  // Executed when the pill is clicked or the shortcut is pressed while the owning item is focused.
  action: () => void;
}
