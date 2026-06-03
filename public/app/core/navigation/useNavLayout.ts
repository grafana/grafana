import { getNavPersonaConfig } from 'nav/data';
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import {
  useGetUserPreferencesQuery,
  usePatchUserPreferencesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { type NavModelItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { applyPersonaLayout } from './layoutActions';
import { resolveLayout } from './migrateLayout';
import { buildNavIndex } from './navIndex';
import { projectNavTree, reorderPrimary, togglePin } from './projectNavTree';
import { NAV_LAYOUT_VERSION, type NavLayoutConfig } from './types';

/** Query string parameter that pins a predefined persona's nav items, e.g. `?nav-persona=platform-guy`. */
const NAV_PERSONA_PARAM = 'nav-persona';

export function useNavLayout(canonicalTree: NavModelItem[], pathname: string) {
  const preferences = useGetUserPreferencesQuery(undefined, { skip: !contextSrv.user.isSignedIn });
  const [patchPreferences] = usePatchUserPreferencesMutation();
  const { search } = useLocation();

  // A `nav-persona` query string parameter overrides the saved layout, pinning only that
  // persona's items so everything else falls behind the "Show me more" section.
  const personaOverride = useMemo<NavLayoutConfig | undefined>(() => {
    const personaId = new URLSearchParams(search).get(NAV_PERSONA_PARAM);
    const config = getNavPersonaConfig(personaId);
    if (!config) {
      return undefined;
    }
    return {
      version: NAV_LAYOUT_VERSION,
      personaId: personaId ?? undefined,
      pinnedIds: [...config.orderedPins],
      order: [...config.orderedPins],
    };
  }, [search]);

  const layout = useMemo(
    () =>
      personaOverride ??
      resolveLayout(
        preferences.data?.navbar?.layout as NavLayoutConfig | undefined,
        preferences.data?.navbar?.bookmarkUrls,
        canonicalTree
      ),
    [personaOverride, preferences.data?.navbar, canonicalTree]
  );

  const projected = useMemo(
    () =>
      projectNavTree(canonicalTree, {
        layout,
        bookmarkUrls: preferences.data?.navbar?.bookmarkUrls,
        pathname,
      }),
    [canonicalTree, layout, pathname, preferences.data?.navbar?.bookmarkUrls]
  );

  const persistLayout = useCallback(
    (nextLayout: NavLayoutConfig) => {
      return patchPreferences({
        patchPrefsCmd: {
          navbar: {
            layout: nextLayout,
            bookmarkUrls: [],
          },
        },
      });
    },
    [patchPreferences]
  );

  const onTogglePin = useCallback(
    (id: string) => {
      const index = buildNavIndex(canonicalTree);
      const wasPinned = layout.pinnedIds?.includes(id) ?? false;
      const nextLayout = togglePin(layout, id, index);

      reportInteraction(wasPinned ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', {
        navId: id,
      });

      return persistLayout(nextLayout);
    },
    [canonicalTree, layout, persistLayout]
  );

  const onReorder = useCallback(
    (sourceId: string, destinationId: string) => {
      const primaryIds = projected.primary.map((n) => n.id).filter(Boolean) as string[];
      const nextLayout = reorderPrimary(layout, sourceId, destinationId, primaryIds);
      return persistLayout(nextLayout);
    },
    [layout, projected.primary, persistLayout]
  );

  const onApplyPersona = useCallback(
    (personaId: string) => {
      const personaLayout = applyPersonaLayout(personaId);
      if (!personaLayout) {
        return Promise.resolve();
      }
      reportInteraction('grafana_nav_persona_applied', { personaId });
      return persistLayout(personaLayout);
    },
    [persistLayout]
  );

  const onOverflowExpandedChange = useCallback(
    (expanded: boolean) => {
      if (expanded) {
        reportInteraction('grafana_nav_overflow_opened', {});
      }
      return persistLayout({ ...layout, expandedOverflow: expanded });
    },
    [layout, persistLayout]
  );

  return {
    layout,
    projected,
    onTogglePin,
    onReorder,
    onApplyPersona,
    onOverflowExpandedChange,
    isLoading: preferences.isLoading,
  };
}
