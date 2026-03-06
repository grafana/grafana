import { createElement, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';

import { CommandPaletteAction } from '../types';
import { DASHBOARDS_PRIORITY, RECENT_DASHBOARDS_PRIORITY } from '../values';

import { useScopeServicesState } from './scopesUtils';

export function useRecentScopesActions(): CommandPaletteAction[] {
  const services = useScopesServices();
  const scopesSelectorService = services?.scopesSelectorService;

  return useMemo(() => {
    if (!(config.featureToggles.scopeFilters && scopesSelectorService)) {
      return [];
    }

    const recentScopes = scopesSelectorService.getRecentScopes();

    return recentScopes.map((recentScope) => {
      const names = recentScope.map((scope) => scope.spec.title).join(', ');
      const keywords = recentScope
        .map((scope) => `${scope.spec.title} ${scope.metadata.name}`)
        .concat(names)
        .join(' ');
      return {
        id: `recent-scope/${names}`,
        name: names,
        section: t('command-palette.section.recents', 'Recents'),
        subtitle: t('command-palette.action.scope', 'Scope'),
        keywords: keywords,
        priority: RECENT_DASHBOARDS_PRIORITY,
        icon: createElement(Icon, { name: 'filter' }),
        perform: () => {
          scopesSelectorService.changeScopes(recentScope.map((scope) => scope.metadata.name));
        },
      };
    });
  }, [scopesSelectorService]);
}

export function useClearScopesAction(): CommandPaletteAction[] {
  const { appliedScopes } = useScopeServicesState();
  const services = useScopesServices();
  const scopesSelectorService = services?.scopesSelectorService;

  return useMemo(() => {
    if (!(config.featureToggles.scopeFilters && scopesSelectorService && appliedScopes.length > 0)) {
      return [];
    }

    return [
      {
        id: 'clear-scopes',
        name: t('command-palette.action.clear-scopes', 'Clear scopes'),
        section: t('command-palette.section.dashboards', 'Dashboards'),
        priority: DASHBOARDS_PRIORITY,
        icon: createElement(Icon, { name: 'times-circle' }),
        perform: () => {
          scopesSelectorService.removeAllScopes();
        },
      },
    ];
  }, [scopesSelectorService, appliedScopes.length]);
}
