import { type ReactNode } from 'react';

import { type LinkTarget } from '@grafana/data';

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

// The behavior part shared by items and additional actions: what happens when they are triggered.
export interface CmdkActionBehavior {
  type: 'action';

  // Executed when triggered.
  action: () => void;
}

export interface CmdkNavigationBehavior {
  type: 'navigation';

  // Navigates to the href when triggered.
  href: string;
  // Optional link target, e.g. '_blank' to open in a new tab.
  target?: LinkTarget;
}

export interface CmdkSubscopeBehavior {
  type: 'subscope';

  // Pushes the returned source onto the subscope stack when triggered, allowing for faceted UI in the cmdk.
  getScope: () => CmdkSource;
}

export type CmdkItem = CmdkItemBase & (CmdkActionBehavior | CmdkNavigationBehavior | CmdkSubscopeBehavior);
export type CmdkItemAction = CmdkItemBase & CmdkActionBehavior;
export type CmdkItemNavigation = CmdkItemBase & CmdkNavigationBehavior;
export type CmdkItemSubscope = CmdkItemBase & CmdkSubscopeBehavior;

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
  // a smaller text shown next to the title
  subtitle?: string;
  // additional small text items that will be displayed next to the subtitle in single line.
  subtitleItems?: string[];

  // actions that can be performed on the item. They will be shown as pills on the right edge of the item. These
  // will be executed if the shortcut is pressed when focus is on the item.
  additionalActions?: CmdkAction[];

  // A component that will be rendered as a detail of the item in the right hand side of the split view when the
  // item is focused.
  renderDetail?: () => ReactNode;
}

export interface CmdkActionBase {
  title: string;
  // Keyboard shortcut like 'mod+d' or 'shift+enter'.
  shortcut: string;
}

// Additional actions on an item, shown as pills. Triggered when the pill is clicked or the shortcut is pressed
// while the owning item is focused. The subscope behavior lets an item both navigate on select and offer diving
// into its children, e.g. a nav item with subpages.
export type CmdkAction = CmdkActionBase & (CmdkActionBehavior | CmdkSubscopeBehavior);
export type CmdkActionCallback = CmdkActionBase & CmdkActionBehavior;
export type CmdkActionSubscope = CmdkActionBase & CmdkSubscopeBehavior;
