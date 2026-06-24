import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import {
  useGetUserPreferencesQuery,
  usePatchUserPreferencesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { useListPreferencesQuery, useUpdatePreferencesMutation } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { setBookmark } from 'app/core/reducers/navBarTree';
import { useDispatch, useSelector } from 'app/types/store';

import { contextSrv } from '../../../services/context_srv';

import {
  enrichWithInteractionTracking,
  expandPinnedUrls,
  findByUrl,
  getActiveItem,
  getPinnableLeafUrls,
  hideItem,
  isHideable,
  NON_MENU_NAV_IDS,
  normalizePinnedUrls,
  partitionNavForPinning,
  removeHiddenItems,
  revealItem,
} from './utils';

export const usePinnedItems = () => {
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const k8sPreferences = useListPreferencesQuery(
    contextSrv.user.isSignedIn && newPrefsEnabled
      ? { fieldSelector: `metadata.name=user-${contextSrv.user.uid}` }
      : skipToken
  );
  // TODO remove the legacy query once newPrefsEnabled is fully rolled out
  const legacyPreferences = useGetUserPreferencesQuery(
    contextSrv.user.isSignedIn && !newPrefsEnabled ? undefined : skipToken
  );

  const preferences = newPrefsEnabled ? k8sPreferences.data?.items[0]?.spec : legacyPreferences.data;
  const isLoading = newPrefsEnabled ? k8sPreferences.isLoading : legacyPreferences.isLoading;
  const pinnedItems = useMemo(() => preferences?.navbar?.bookmarkUrls || [], [preferences]);

  return { pinnedItems, isLoading };
};

export const HIDDEN_ITEMS_STORAGE_KEY = 'grafana.navigation.megamenu.hidden-items';

/**
 * Storage seam for the hidden nav item ids. Backed by localStorage today (per-browser), but shaped
 * like an RTK query hook (`{ data, isLoading }` + a persist function) so the consumer already treats
 * it as async — swapping in a preferences-API-backed implementation later is a drop-in.
 */
const useHiddenItems = (): { data: string[]; isLoading: boolean; setHiddenItemIds: (ids: string[]) => void } => {
  const [stored, setStored] = useLocalStorage<string[]>(HIDDEN_ITEMS_STORAGE_KEY, []);
  // localStorage is synchronous, so this never actually loads — a preferences-backed impl would.
  return { data: stored ?? [], isLoading: false, setHiddenItemIds: setStored };
};

/**
 * Owns the mega-menu customisation behaviour (behind the `grafana.customizableMegaMenu` flag):
 * hiding top-level items, pinning items to the top, collapsing the rest, and resetting — plus the
 * legacy (flag-off) bookmarks behaviour. Returns the derived nav structures and the handlers the
 * menu renders with, keeping `MegaMenu` itself a thin renderer.
 */
export const useNavCustomization = () => {
  const navTree = useSelector((state) => state.navBarTree);
  const location = useLocation();
  const { chrome } = useGrafana();
  const dispatch = useDispatch();
  const state = chrome.useState();
  const docked = state.megaMenuDocked;
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const [patchPreferences] = usePatchUserPreferencesMutation();
  const [patchPreferencesK8s] = useUpdatePreferencesMutation();
  const { pinnedItems, isLoading: pinnedLoading } = usePinnedItems();
  const notifyApp = useAppNotification();
  const { data: hiddenItemIds, isLoading: hiddenLoading, setHiddenItemIds } = useHiddenItems();

  // Persist the bookmark urls via the app-platform preferences API when the new-preferences flag is
  // on, otherwise the legacy endpoint.
  // TODO drop the legacy branch once newPrefsEnabled is fully rolled out.
  const persistBookmarkUrls = useCallback(
    (bookmarkUrls: string[], onSuccess?: () => void) => {
      const onResult = (result: { error?: unknown }) => {
        if (result.error) {
          notifyApp.error(t('navigation.megamenu.pin-error', 'Failed to update pinned menu items'));
          return;
        }
        onSuccess?.();
      };
      if (newPrefsEnabled) {
        patchPreferencesK8s({
          name: `user-${contextSrv.user.uid}`,
          patch: { spec: { navbar: { bookmarkUrls } } },
        }).then(onResult);
      } else {
        patchPreferences({ patchPrefsCmd: { navbar: { bookmarkUrls } } }).then(onResult);
      }
    },
    [newPrefsEnabled, patchPreferences, patchPreferencesK8s, notifyApp]
  );

  const canCustomise = useBooleanFlagValue('grafana.customizableMegaMenu', false) && contextSrv.isSignedIn;
  // Render a skeleton until the customisation state has loaded on first visit, so the menu doesn't
  // render then reflow (pins jumping to the top / hidden items disappearing). Cached after that.
  const isLoading = canCustomise && (pinnedLoading || hiddenLoading);

  const [editMode, setEditMode] = useState(false);

  // The applied hidden set; draftHiddenIds holds the in-progress edits until the user saves.
  const [draftHiddenIds, setDraftHiddenIds] = useState<string[]>(hiddenItemIds);

  // Local copy of the pinned urls so pin/unpin updates the menu immediately (the patch mutation
  // doesn't invalidate the query); draftPinnedUrls mirrors it during edit mode so staged changes
  // (e.g. "Reset to default") preview live and only persist on save. Synced during render when the
  // query result's *contents* change — compared by value, not reference, so an unrelated preferences
  // refetch (a new array with the same urls) doesn't needlessly re-render the menu.
  const pinnedItemsKey = pinnedItems.join('\n');
  const [pinnedUrls, setPinnedUrls] = useState<string[]>(pinnedItems);
  const [draftPinnedUrls, setDraftPinnedUrls] = useState<string[]>(pinnedItems);
  const lastSyncedPinnedUrls = useRef(pinnedItemsKey);
  if (lastSyncedPinnedUrls.current !== pinnedItemsKey) {
    lastSyncedPinnedUrls.current = pinnedItemsKey;
    setPinnedUrls(pinnedItems);
    setDraftPinnedUrls(pinnedItems);
  }

  // The non-pinned items collapse below the pinned block; reset that on the last unpin so re-pinning
  // later starts expanded rather than behind a stale collapse.
  const [unpinnedExpanded, setUnpinnedExpanded] = useLocalStorage(
    'grafana.navigation.megamenu.unpinned-expanded',
    true
  );
  const hadPinnedItems = useRef(pinnedUrls.length > 0);
  useEffect(() => {
    if (hadPinnedItems.current && pinnedUrls.length === 0) {
      setUnpinnedExpanded(true);
    }
    hadPinnedItems.current = pinnedUrls.length > 0;
  }, [pinnedUrls.length, setUnpinnedExpanded]);

  // Base tree without the items the mega menu never lists directly. When customisation is on, the
  // dedicated Bookmarks section is also dropped — pinned items are re-presented at the top.
  const baseItems = navTree.filter(
    (item) => !NON_MENU_NAV_IDS[item.id ?? ''] && !(canCustomise && item.id === 'bookmarks')
  );

  // In edit mode the menu previews the staged (draft) pins; outside it shows the applied pins.
  const effectivePinnedUrls = editMode ? draftPinnedUrls : pinnedUrls;
  const pinnedSet = new Set(effectivePinnedUrls);

  const { pinned: pinnedTree, rest: movedRest } = partitionNavForPinning(baseItems, pinnedSet);

  // Pinned subtree shown at the top of the menu. Pinning a child pulls in its ancestor chain
  // (e.g. "Dashboards → Playlists"); pinned items are "moved" here and removed from the rest below.
  const pinnedNavItems = (canCustomise ? pinnedTree : []).map((item) => enrichWithInteractionTracking(item, docked));

  // Normal nav. Outside edit mode, recursively drop the items the user has hidden (a hidden parent
  // takes its subtree with it); in edit mode every item is shown so hidden ones can be toggled.
  const rest = canCustomise ? movedRest : baseItems;
  const visibleRest = canCustomise && !editMode ? removeHiddenItems(rest, new Set(hiddenItemIds)) : rest;
  const navItems = visibleRest.map((item) => enrichWithInteractionTracking(item, docked));

  if (!canCustomise) {
    const bookmarksItem = navItems.find((item) => item.id === 'bookmarks');
    if (bookmarksItem) {
      // Add children to the legacy bookmarks section
      bookmarksItem.children = pinnedItems.reduce<NavModelItem[]>((acc, url) => {
        const item = findByUrl(navItems, url);
        if (!item) {
          return acc;
        }
        acc.push(
          enrichWithInteractionTracking(
            { id: item.id, text: item.text, url: item.url, parentItem: { id: 'bookmarks', text: 'Bookmarks' } },
            docked
          )
        );
        return acc;
      }, []);
    }
  }

  // The non-pinned items become collapsible once something is pinned (but stay expanded while
  // editing, so every item is reachable to toggle its visibility).
  const unpinnedCollapsible = canCustomise && pinnedNavItems.length > 0 && !editMode;
  const showUnpinnedItems = !unpinnedCollapsible || (unpinnedExpanded ?? true);

  // Resolve the active item across the pinned rows and the rest in one search. A pinned section is
  // moved out of `navItems`, so searching `navItems` alone would fail to find it and walk up the
  // parent chain to wrongly highlight an ancestor section; searching the combined list finds the
  // (rendered) pinned node and stops there. Reference equality then highlights whichever row renders.
  const activeItem = getActiveItem([...pinnedNavItems, ...navItems], state.sectionNav.node, location.pathname);

  const isPinned = useCallback(
    (url?: string) => Boolean(url && effectivePinnedUrls.includes(url)),
    [effectivePinnedUrls]
  );

  const persistPinned = (newItems: string[]) => {
    persistBookmarkUrls(newItems, () => setPinnedUrls(newItems));
  };

  const onPinItem = (item: NavModelItem, isUnpin: boolean) => {
    const { url } = item;
    if (!url) {
      return;
    }
    if (canCustomise) {
      // Work on the flat set of effective pinned leaves, then re-collapse to canonical storage:
      // pinning a section adds all its leaves (which may collapse to the section); unpinning a
      // section removes them all; unpinning a single leaf of a whole-pinned section expands it
      // back into the remaining siblings. `isUnpin` is the direction (set by where it was clicked).
      const leaves = getPinnableLeafUrls(item);
      if (!leaves.length) {
        return;
      }
      const effective = expandPinnedUrls(effectivePinnedUrls, baseItems);
      leaves.forEach((leaf) => (isUnpin ? effective.delete(leaf) : effective.add(leaf)));
      const next = normalizePinnedUrls(effective, baseItems);
      reportInteraction(isUnpin ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', { path: url });
      // In edit mode stage the change for the next save; otherwise persist immediately.
      if (editMode) {
        setDraftPinnedUrls(next);
      } else {
        persistPinned(next);
      }
    } else {
      // Legacy bookmarks behaviour (flag off): single-url toggle + redux Bookmarks section update.
      const isSaved = isPinned(url);
      const newItems = isSaved ? pinnedUrls.filter((i) => url !== i) : [...pinnedUrls, url];
      reportInteraction(isSaved ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', { path: url });
      persistBookmarkUrls(newItems, () => {
        setPinnedUrls(newItems);
        dispatch(setBookmark({ item, isSaved: !isSaved }));
      });
    }
  };

  const isItemHideable = useCallback((item: NavModelItem) => isHideable(item), []);

  const isHidden = useCallback((item: NavModelItem) => draftHiddenIds.includes(item.id ?? ''), [draftHiddenIds]);

  // Hide adds the item's id (no collapse to parent); reveal "breaks apart" a hidden ancestor so
  // only this item's path is shown and the rest of the hidden subtree stays hidden.
  const onToggleHidden = useCallback(
    (item: NavModelItem, effectivelyHidden: boolean) => {
      if (!item.id) {
        return;
      }
      setDraftHiddenIds((current) =>
        effectivelyHidden ? revealItem(current, baseItems, item.id!) : hideItem(current, baseItems, item.id!)
      );
    },
    [baseItems]
  );

  const onEnterEditMode = useCallback(() => {
    setDraftHiddenIds(hiddenItemIds);
    setDraftPinnedUrls(pinnedUrls);
    setEditMode(true);
  }, [hiddenItemIds, pinnedUrls]);

  const onCancelEdit = useCallback(() => {
    setDraftHiddenIds(hiddenItemIds);
    setDraftPinnedUrls(pinnedUrls);
    setEditMode(false);
  }, [hiddenItemIds, pinnedUrls]);

  const onSaveEdit = useCallback(() => {
    reportInteraction('grafana_nav_customise_saved', {
      hiddenCount: draftHiddenIds.length,
      pinnedCount: draftPinnedUrls.length,
    });
    // Hidden state persists to localStorage; pins persist to preferences.
    setHiddenItemIds(draftHiddenIds);
    persistBookmarkUrls(draftPinnedUrls, () => setPinnedUrls(draftPinnedUrls));
    setEditMode(false);
  }, [draftHiddenIds, draftPinnedUrls, persistBookmarkUrls, setHiddenItemIds]);

  // Only offer a reset when there is something staged to reset.
  const canReset = draftHiddenIds.length > 0 || draftPinnedUrls.length > 0;

  // Stage the reset (cleared on save, discarded on cancel) rather than persisting immediately.
  const onResetToDefault = useCallback(() => {
    reportInteraction('grafana_nav_customise_reset');
    setDraftHiddenIds([]);
    setDraftPinnedUrls([]);
  }, []);

  return {
    canCustomise,
    isLoading,
    navItems,
    pinnedNavItems,
    activeItem,
    isPinned,
    onPinItem,
    isHideable: isItemHideable,
    isHidden,
    onToggleHidden,
    editMode,
    canReset,
    onEnterEditMode,
    onCancelEdit,
    onSaveEdit,
    onResetToDefault,
    unpinnedCollapsible,
    showUnpinnedItems,
    setUnpinnedExpanded,
  };
};
