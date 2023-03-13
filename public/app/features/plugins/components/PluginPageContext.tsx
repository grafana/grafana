import React from 'react';

import { NavModel } from '@grafana/data';

export interface PluginPageContextType {
  sectionNav: NavModel;
  /**
   * Only used when wrapping a SceneApp in core
   */
  navId?: string;
}

export const PluginPageContext = React.createContext(getInitialPluginPageContext());

PluginPageContext.displayName = 'PluginPageContext';

function getInitialPluginPageContext(): PluginPageContextType {
  return {
    sectionNav: {
      main: { text: 'Plugin page' },
      node: { text: 'Plugin page' },
    },
  };
}

export function buildPluginPageContext(sectionNav: NavModel | undefined): PluginPageContextType {
  return {
    sectionNav: sectionNav ?? getInitialPluginPageContext().sectionNav,
  };
}
