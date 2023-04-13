import { ComponentType } from 'react';

import { LinkTarget } from './dataLink';
import { IconName } from './icon';

export interface NavLinkDTO {
  id?: string;
  text: string;
  description?: string;
  subTitle?: string;
  icon?: IconName;
  img?: string;
  url?: string;
  target?: LinkTarget;
  sortWeight?: number;
  hideFromTabs?: boolean;
  roundIcon?: boolean;
  /**
   * This is true for some sections that have no children (but is still a section)
   **/
  isSection?: boolean;
  children?: NavLinkDTO[];
  highlightText?: string;
  emptyMessageId?: string;
  // The ID of the plugin that registered the page (in case it was registered by a plugin, otherwise left empty)
  pluginId?: string;
  // Whether the page is used to create a new resource. We may place these in a different position in the UI.
  isCreateAction?: boolean;
}

export interface NavModelItem extends NavLinkDTO {
  children?: NavModelItem[];
  active?: boolean;
  breadcrumbs?: NavModelBreadcrumb[];
  parentItem?: NavModelItem;
  showOrgSwitcher?: boolean;
  onClick?: () => void;
  menuItemType?: NavMenuItemType;
  highlightText?: string;
  highlightId?: string;
  tabSuffix?: ComponentType<{ className?: string }>;
  hideFromBreadcrumbs?: boolean;
  emptyMessage?: string;
}

export enum NavMenuItemType {
  Section = 'section',
  Item = 'item',
}

/**
 *  Interface used to describe  different kinds of page titles and page navigation. Navmodels are usually generated in the backend and stored in Redux.
 */
export interface NavModel {
  /**
   *  Main page. that wraps the navigation. Generate the `children` property generate tabs when used with the Page component.
   */
  main: NavModelItem;
  /**
   *   This is the current active tab/navigation.
   */
  node: NavModelItem;
}

export interface NavModelBreadcrumb {
  title: string;
  url?: string;
}

export type NavIndex = { [s: string]: NavModelItem };

export enum PageLayoutType {
  Standard,
  Canvas,
  Custom,
}
