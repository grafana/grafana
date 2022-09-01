import React from 'react';

import { NavModelItem } from '@grafana/data';

export interface PluginPageProps {
  pageNav?: NavModelItem;
  children: React.ReactNode;
  layout?: PluginPageLayout;
}

export enum PluginPageLayout {
  Standard,
  Canvas,
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
