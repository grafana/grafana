import React from 'react';

import { NavModelItem, PageLayoutType } from '@grafana/data';

export interface PluginPageProps {
  /** Secondary title shown under the main title */
  subTitle?: React.ReactNode;
  /** Sets meta-information for the currently active page. Can be used when the page itself is not part of the navigation tree (e.g. a parameterized route "items/:id" ) or if we would like to customise the navModel. */
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
