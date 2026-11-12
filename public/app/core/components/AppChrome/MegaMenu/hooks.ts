import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { useListPreferencesQuery, useUpdatePreferencesMutation } from '@grafana/api-clients/rtkq/preferences/v1';
import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaNavigationInfoArchRefresh } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useNavTree } from 'app/core/navtree/useNavTree';
import { findNavByUrl } from 'app/core/navtree/utils';
import { setBookmark } from 'app/core/reducers/navBarTree';
import { useStarredSearch } from 'app/features/stars/hooks';
import { useDispatch } from 'app/types/store';

import { contextSrv } from '../../../services/context_srv';

import {
  enrichWithInteractionTracking,
  getActiveItem,
  getPinnedEntries,
  HIDDEN_NAV_ITEMS,
  NON_MENU_NAV_IDS,
  removeEmptySavedSections,
  removeHiddenItems,
} from './utils';

export const usePinnedItems = () => {
  const k8sPreferences = useListPreferencesQuery(
    contextSrv.user.isSignedIn ? { fieldSelector: `metadata.name=user-${contextSrv.user.uid}` } : skipToken
  );

  const preferences = k8sPreferences.data?.items[0]?.spec;
  const isLoading = k8sPreferences.isLoading;
  const pinnedItems = useMemo(() => preferences?.navbar?.bookmarkUrls || [], [preferences]);

  return { pinnedItems, isLoading };
};

const usePinning = () => {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [patchPreferencesK8s] = useUpdatePreferencesMutation();
  const { pinnedItems, isLoading } = usePinnedItems();
  const pending = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pinnedUrls, setPinnedUrls] = useState(pinnedItems);
  const lastSyncedPinnedUrls = useRef(pinnedItems.join('\n'));
  if (lastSyncedPinnedUrls.current !== pinnedItems.join('\n')) {
    lastSyncedPinnedUrls.current = pinnedItems.join('\n');
    setPinnedUrls(pinnedItems);
  }

  const isPinned = useCallback((url?: string) => Boolean(url && pinnedUrls.includes(url)), [pinnedUrls]);
  const onPinItem = async (item: NavModelItem) => {
    if (!item.url || !contextSrv.isSignedIn || pending.current || isLoading) {
      return;
    }
    const isSaved = isPinned(item.url);
    const newItems = isSaved ? pinnedUrls.filter((url) => url !== item.url) : [...pinnedUrls, item.url];
    // A ref guards same-tick actions before the disabled controls have re-rendered.
    pending.current = true;
    setIsSaving(true);
    try {
      const result = await patchPreferencesK8s({
        name: `user-${contextSrv.user.uid}`,
        patch: { spec: { navbar: { bookmarkUrls: newItems } } },
      });
      if (result.error) {
        notifyApp.error(t('navigation.megamenu.pin-error', 'Failed to update pinned menu items'));
        return;
      }
      setPinnedUrls(newItems);
      dispatch(setBookmark({ item, isSaved: !isSaved }));
      reportInteraction(isSaved ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', { path: item.url });
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return { pinnedUrls, isLoading, isSaving, isPinned, onPinItem };
};

export const useMegaMenuNavigation = () => {
  const navTree = useNavTree();
  const location = useLocation();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const navigationInfoArchRefresh = useFlagGrafanaNavigationInfoArchRefresh();
  const { pinnedUrls, isLoading, isSaving, isPinned, onPinItem } = usePinning();
  // Re-search on each open to pick up renames and deletes from other tabs.
  const { loading: starredItemsLoading, error: starredItemsError } = useStarredSearch({
    refetchOnMountOrArgChange: true,
  });

  const hiddenNavItems = new Set(
    [...NON_MENU_NAV_IDS, ...(navigationInfoArchRefresh ? HIDDEN_NAV_ITEMS : [])].map((key) =>
      key.startsWith('/') ? `${config.appSubUrl}${key}` : key
    )
  );
  const baseItems = removeHiddenItems(navTree, hiddenNavItems).filter(
    (item) => !(navigationInfoArchRefresh && item.id === 'bookmarks')
  );
  const pinnedEntries = (navigationInfoArchRefresh ? getPinnedEntries(baseItems, pinnedUrls) : []).map((entry) =>
    entry.section
      ? { ...entry, section: enrichWithInteractionTracking(entry.section, state.megaMenuDocked) }
      : {
          ...entry,
          line: { ...entry.line, item: enrichWithInteractionTracking(entry.line.item, state.megaMenuDocked) },
        }
  );
  const enrichedNavItems = baseItems.map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked));

  if (!navigationInfoArchRefresh) {
    const bookmarksItem = enrichedNavItems.find((item) => item.id === 'bookmarks');
    if (bookmarksItem) {
      bookmarksItem.children = pinnedUrls.reduce<NavModelItem[]>((acc, url) => {
        const item = findNavByUrl(enrichedNavItems, (itemUrl) => itemUrl === url);
        if (item) {
          acc.push(
            enrichWithInteractionTracking(
              { id: item.id, text: item.text, url: item.url, parentItem: { id: 'bookmarks', text: 'Bookmarks' } },
              state.megaMenuDocked
            )
          );
        }
        return acc;
      }, []);
    }
  }

  const navItems = navigationInfoArchRefresh
    ? removeEmptySavedSections(enrichedNavItems, {
        starredPending: starredItemsLoading || starredItemsError,
        bookmarksPending: isLoading,
      })
    : enrichedNavItems;

  const pinnedLeafItems = pinnedEntries.flatMap((entry) =>
    entry.section ? [entry.section, ...(entry.section.children ?? [])] : [entry.line.item]
  );
  const activeItem = getActiveItem([...navItems, ...pinnedLeafItems], state.sectionNav.node, location.pathname);

  return {
    navigationInfoArchRefresh,
    isSaving,
    isLoading: navigationInfoArchRefresh && isLoading,
    navItems,
    starredItemsLoading,
    starredItemsError,
    pinnedEntries,
    activeItem,
    isPinned,
    onPinItem,
  };
};
