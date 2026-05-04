import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { type ScopesSelectorServiceState } from 'app/features/scopes/selector/ScopesSelectorService';
import { useRecentScopes } from 'app/features/scopes/selector/useRecentScopes';

import { type CommandPaletteAction } from '../types';
import { RECENT_SCOPES_PRIORITY } from '../values';

export function useRecentScopesActions(): CommandPaletteAction[] {
  const services = useScopesServices();

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services?.scopesSelectorService.stateObservable ?? new Observable(),
    services?.scopesSelectorService.state
  );

  const appliedScopeIds = selectorServiceState?.appliedScopes.map((s) => s.scopeId) ?? [];
  const recentScopes = useRecentScopes(appliedScopeIds);

  if (!(config.featureToggles.scopeFilters && services)) {
    return [];
  }

  const { scopesSelectorService } = services;

  return recentScopes.map((recentScopeSet) => {
    const names = recentScopeSet.scopes.map((s) => s.title).join(', ');
    const keywords = recentScopeSet.scopes
      .map((s) => `${s.title} ${s.id}`)
      .concat(names)
      .join(' ');
    return {
      id: recentScopeSet.scopeIds.join(','),
      name: names,
      section: {
        name: t('command-palette.section.recent-scopes', 'Recent scopes'),
        priority: RECENT_SCOPES_PRIORITY,
      },
      subtitle: recentScopeSet.parentNodeTitle,
      keywords: keywords,
      priority: RECENT_SCOPES_PRIORITY,
      perform: () => {
        scopesSelectorService.changeScopes(recentScopeSet.scopeIds, undefined, recentScopeSet.scopeNodeId);
      },
    };
  });
}
