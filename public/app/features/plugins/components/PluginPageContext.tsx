import { createContext } from 'react';

import { NavModel } from '@grafana/data';

export interface PluginPageContextType {
  sectionNav: NavModel;
}

export const PluginPageContext = createContext(getInitialPluginPageContext());

PluginPageContext.displayName = 'PluginPageContext';

function getInitialPluginPageContext(): PluginPageContextType {
  return {
    sectionNav: {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      main: { text: 'Plugin page' },
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      node: { text: 'Plugin page' },
    },
  };
}

export function buildPluginPageContext(sectionNav: NavModel | undefined): PluginPageContextType {
  return {
    sectionNav: sectionNav ?? getInitialPluginPageContext().sectionNav,
  };
}
