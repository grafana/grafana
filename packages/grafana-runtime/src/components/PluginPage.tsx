import React from 'react';

import { NavModel, NavModelItem, PageLayoutType } from '@grafana/data';

export interface PluginPageProps {
  /** Secondary title shown under the main title */
  subTitle?: React.ReactNode;
  /** Sets the currently active navigation item by using its ID. Overrides the `navModel` prop if used. (Only for customisation, Grafana should figure it out automatically.) */
  navId?: string;
  /** Sets the navigation model for the side-menu and for the breadcumbs manually. (Only for customisation, Grafana should figure it out automatically..) */
  navModel?: NavModel;
  /** Sets meta-information for the currently active page. Needed when the page itself is not part of the navigation tree (e.g. a parameterized route "items/:id" ) */
  pageNav?: NavModelItem;
  /** The layout of the page */
  layout?: PageLayoutType;
  children: React.ReactNode;
}

export type PluginPageType = React.ComponentType<PluginPageProps>;

export let PluginPage: PluginPageType = ({ children }) => {
  return <div>{children}</div>;
};

/**
 * Used to bootstrap the PluginPage during application start
 * is exposed via runtime.
 *
 * @internal
 */
export function setPluginPage(component: PluginPageType) {
  PluginPage = component;
}
