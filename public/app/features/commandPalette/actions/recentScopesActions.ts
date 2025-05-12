import { useTranslate } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';

import { CommandPaletteAction } from '../types';
import { RECENT_SCOPES_PRIORITY } from '../values';

export function getRecentScopesActions(): CommandPaletteAction[] {
  const services = useScopesServices();
  const { t } = useTranslate();
  if (!(config.featureToggles.scopeFilters && services)) {
    return [];
  }

  const { scopesSelectorService } = services;
  const recentScopes = scopesSelectorService.getRecentScopes();

  return recentScopes.map((recentScope) => {
    return {
      id: recentScope.map((scope) => scope.scope.spec.title).join(', '),
      name: recentScope.map((scope) => scope.scope.spec.title).join(', '),
      section: t('command-palette.section.recent-scopes', 'Recent scopes'),
      priority: RECENT_SCOPES_PRIORITY,
      perform: () => {
        scopesSelectorService.changeScopes(recentScope.map((scope) => scope.scope.metadata.name));
      },
    };
  });
}
