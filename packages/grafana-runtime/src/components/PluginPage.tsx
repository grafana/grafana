import React from 'react';

import { NavModelItem, PageLayoutType } from '@grafana/data';

export interface PageInfoItem {
  label: string;
  value: React.ReactNode;
}

export interface PluginPageProps {
  /** Can be used to place actions inline with the heading */
  info?: PageInfoItem[];
  /** Can be used to place actions inline with the heading */
  actions?: React.ReactNode;
  /** Can be used to customize rendering of title */
  renderTitle?: (title: string) => React.ReactNode;
  /** Shown under main heading */
  subTitle?: React.ReactNode;
  pageNav?: NavModelItem;
  children: React.ReactNode;
  layout?: PageLayoutType;
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
