import { Scope } from '@grafana/data';
import { t } from 'app/core/internationalization';
import { defaultScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { RECENT_SCOPES_KEY } from 'app/features/scopes/selector/ScopesSelectorService';

import { CommandPaletteAction } from '../types';
import { RECENT_SCOPES_PRIORITY } from '../values';

export function getRecentScopesActions(): CommandPaletteAction[] {
  let recentScopes: Scope[] = JSON.parse(localStorage.getItem(RECENT_SCOPES_KEY) || '[]');
  const { scopesSelectorService } = defaultScopesServices();
  const selectedScopes = scopesSelectorService.state.selectedScopes;
  const selectedScopesNames = new Set(selectedScopes.map((s) => s.scope.metadata.name));

  recentScopes = recentScopes.filter((scope) => !selectedScopesNames.has(scope.metadata.name));

  return recentScopes.map((scope) => {
    return {
      id: scope.metadata.name,
      name: scope.spec.title,
      section: t('command-palette.section.recent-scopes', 'Recent scopes'),
      priority: RECENT_SCOPES_PRIORITY,
      perform: () => {
        scopesSelectorService.changeScopes([scope.metadata.name, ...selectedScopesNames]);
      },
    };
  });
}
