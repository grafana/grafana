import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';

import { CommandPaletteAction } from '../types';
import { RECENT_SCOPES_PRIORITY } from '../values';

export function useRecentScopesActions(): CommandPaletteAction[] {
  const services = useScopesServices();

  if (!(config.featureToggles.scopeFilters && services)) {
    return [];
  }

  const { scopesSelectorService } = services;
  const recentScopes = scopesSelectorService.getRecentScopes();

  return recentScopes.map((recentScope) => {
    const names = recentScope.map((scope) => scope.spec.title).join(', ');
    const keywords = recentScope
      .map((scope) => `${scope.spec.title} ${scope.metadata.name}`)
      .concat(names)
      .join(' ');
    return {
      id: names,
      name: names,
      section: {
        name: t('command-palette.section.recent-scopes', 'Recent scopes'),
        priority: RECENT_SCOPES_PRIORITY,
      },
      subtitle: recentScope[0]?.parentNode?.spec.title,
      keywords: keywords,
      priority: RECENT_SCOPES_PRIORITY,
      perform: () => {
        scopesSelectorService.changeScopes(recentScope.map((scope) => scope.metadata.name));
      },
    };
  });
}
