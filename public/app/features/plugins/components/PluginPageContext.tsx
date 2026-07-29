import { createContext } from 'react';

import { type NavModel } from '@grafana/data';

export interface PluginPageContextType {
  sectionNav: NavModel;
  pluginId?: string;
}

export const PluginPageContext = createContext(getInitialPluginPageContext());

PluginPageContext.displayName = 'PluginPageContext';

function getInitialPluginPageContext(pluginId?: string): PluginPageContextType {
  return {
    sectionNav: {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      main: { text: 'Plugin page' },
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      node: { text: 'Plugin page' },
    },
    pluginId,
  };
}

export function buildPluginPageContext(sectionNav: NavModel | undefined, pluginId: string): PluginPageContextType {
  return {
    sectionNav: sectionNav ?? getInitialPluginPageContext(pluginId).sectionNav,
    pluginId,
  };
}
