import React from 'react';

import { NavModelItem } from '@grafana/data';

export interface PluginPageProps {
  pageNav?: NavModelItem;
  children: React.ReactNode;
}

export type PluginPageType = React.ComponentType<PluginPageProps>;

export const PluginPage: PluginPageType = ({ children }) => {
  return <div>{children}</div>;
};
