import { createContext } from 'react';

import { NavModel } from '@grafana/data';
import { t } from 'app/core/internationalization';

export interface PluginPageContextType {
  sectionNav: NavModel;
}

export const PluginPageContext = createContext(getInitialPluginPageContext());

PluginPageContext.displayName = 'PluginPageContext';

function getInitialPluginPageContext(): PluginPageContextType {
  return {
    sectionNav: {
      main: { text: t('plugins.get-initial-plugin-page-context.text.plugin-page', 'Plugin page') },
      node: { text: t('plugins.get-initial-plugin-page-context.text.plugin-page', 'Plugin page') },
    },
  };
}

export function buildPluginPageContext(sectionNav: NavModel | undefined): PluginPageContextType {
  return {
    sectionNav: sectionNav ?? getInitialPluginPageContext().sectionNav,
  };
}
