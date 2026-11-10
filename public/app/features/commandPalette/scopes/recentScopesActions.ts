import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useRecentScopes } from 'app/features/scopes/selector/useRecentScopes';
import { useScopeActions } from 'app/features/scopes/selector/useScopeActions';
import { useAppliedScopeIds } from 'app/features/scopes/selector/useScopesSelectorState';

import { type CommandPaletteAction } from '../types';
import { SECTION_RECENT_SCOPES, RECENT_SCOPES_PRIORITY } from '../values';

export function useRecentScopesActions(): CommandPaletteAction[] {
  const appliedScopeIds = useAppliedScopeIds();
  const recentScopes = useRecentScopes(appliedScopeIds);
  const { isAvailable, changeScopes } = useScopeActions();

  if (!(config.featureToggles.scopeFilters && isAvailable)) {
    return [];
  }

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
      sectionId: SECTION_RECENT_SCOPES,
      subtitle: recentScopeSet.parentNodeTitle,
      keywords: keywords,
      priority: RECENT_SCOPES_PRIORITY,
      perform: () => {
        changeScopes(recentScopeSet.scopeIds, { scopeNodeId: recentScopeSet.scopeNodeId });
      },
    };
  });
}
