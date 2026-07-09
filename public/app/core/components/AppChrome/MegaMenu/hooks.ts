import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  findByUrl,
  getActiveItem,
  getPinnedEntries,
  hiddenKey,
  hideItem,
  isHideable,
  moveItem,
  NON_MENU_NAV_IDS,
  orderTopLevelSections,
  removeHiddenItems,
  reorderSections,
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
export const SECTION_ORDER_STORAGE_KEY = 'grafana.navigation.megamenu.section-order';

/**
 * Storage seam for the hidden top-level section ids. Backed by localStorage today (per-browser), but
 * shaped like an RTK query hook so swapping in a preferences-API-backed impl later is a drop-in.
 */
const useHiddenItems = (): { data: string[]; isLoading: boolean; setHiddenItemIds: (ids: string[]) => void } => {
  const [stored, setStored] = useLocalStorage<string[]>(HIDDEN_ITEMS_STORAGE_KEY, []);
  return { data: stored ?? [], isLoading: false, setHiddenItemIds: setStored };
};

/**
 * Owns the mega-menu customisation behaviour (behind the `grafana.customizableMegaMenu` flag):
 * reordering top-level sections (localStorage), pinning any non-top-level item (surfaced as a
 * duplicate in the pinned box), and hiding top-level sections — plus the legacy (flag-off) bookmarks
 * behaviour. Returns the derived nav structures and the handlers the menu renders with, keeping
 * `MegaMenu` a thin renderer.
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
  // The user's custom order for the top-level sections (local-only, not on the API yet).
  const [sectionOrder, setSectionOrder] = useLocalStorage<string[]>(SECTION_ORDER_STORAGE_KEY, []);

  // Persist the bookmark urls via the app-platform preferences API when the new-preferences flag is
  // on, otherwise the legacy endpoint.
  // TODO drop the legacy branch once newPrefsEnabled is fully rolled out.
  const persistBookmarkUrls = useCallback(
    (bookmarkUrls: string[], onSuccess?: () => void): Promise<boolean> => {
      const onResult = (result: { error?: unknown }): boolean => {
        if (result.error) {
          notifyApp.error(t('navigation.megamenu.pin-error', 'Failed to update pinned menu items'));
          return false;
        }
        onSuccess?.();
        return true;
      };
      return newPrefsEnabled
        ? patchPreferencesK8s({
            name: `user-${contextSrv.user.uid}`,
            patch: { spec: { navbar: { bookmarkUrls } } },
          }).then(onResult)
        : patchPreferences({ patchPrefsCmd: { navbar: { bookmarkUrls } } }).then(onResult);
    },
    [newPrefsEnabled, patchPreferences, patchPreferencesK8s, notifyApp]
  );

  const canCustomise = useBooleanFlagValue('grafana.customizableMegaMenu', false) && contextSrv.isSignedIn;
  // Render a skeleton until the customisation state has loaded on first visit, so the menu doesn't
  // render then reflow (pins appearing). Cached after that.
  const isLoading = canCustomise && (pinnedLoading || hiddenLoading);

  const [editMode, setEditMode] = useState(false);
  // Set while the Save (Done) preferences write is in flight, so the control can show a spinner.
  const [isSaving, setIsSaving] = useState(false);

  // Applied state + in-progress drafts (staged until the user saves).
  const [draftHiddenIds, setDraftHiddenIds] = useState<string[]>(hiddenItemIds);
  const [draftSectionOrder, setDraftSectionOrder] = useState<string[]>(sectionOrder ?? []);

  // Local copy of the pinned urls so pin/unpin updates the menu immediately (the patch mutation
  // doesn't invalidate the query); draftPinnedUrls mirrors it during edit mode so staged changes
  // preview live and only persist on save. Synced during render when the query result's *contents*
  // change (compared by value) so an unrelated preferences refetch doesn't needlessly re-render.
  const pinnedItemsKey = pinnedItems.join('\n');
  const [pinnedUrls, setPinnedUrls] = useState<string[]>(pinnedItems);
  const [draftPinnedUrls, setDraftPinnedUrls] = useState<string[]>(pinnedItems);
  const lastSyncedPinnedUrls = useRef(pinnedItemsKey);
  if (lastSyncedPinnedUrls.current !== pinnedItemsKey) {
    lastSyncedPinnedUrls.current = pinnedItemsKey;
    setPinnedUrls(pinnedItems);
    // Don't clobber staged edits while editing — the draft is synced from applied state on enter/cancel.
    if (!editMode) {
      setDraftPinnedUrls(pinnedItems);
    }
  }

  // Base tree without the items the mega menu never lists directly. When customisation is on, the
  // dedicated Bookmarks section is also dropped — pinned items are re-presented in the pinned box.
  const baseItems = navTree.filter(
    (item) => !NON_MENU_NAV_IDS[item.id ?? ''] && !(canCustomise && item.id === 'bookmarks')
  );

  // Pinned box: one breadcrumb entry per pinned url (in the user's order). Pinning duplicates items
  // here; the main nav below is never pruned. Leaf items are enriched so clicks are tracked.
  const pinnedUrlsToDisplay = editMode ? draftPinnedUrls : pinnedUrls;
  const pinnedEntries = (canCustomise ? getPinnedEntries(baseItems, pinnedUrlsToDisplay) : []).map((entry) => ({
    ...entry,
    section: entry.section ? enrichWithInteractionTracking(entry.section, docked) : undefined,
    lines: entry.lines.map((line) => ({ ...line, item: enrichWithInteractionTracking(line.item, docked) })),
  }));
  // The pinned items (section headers + leaves), for active-item resolution alongside the nav.
  const pinnedLeafItems = pinnedEntries.flatMap((entry) => [
    ...(entry.section ? [entry.section] : []),
    ...entry.lines.map((line) => line.item),
  ]);

  // Top-level nav in the user's order; hidden items (any depth) are dropped outside edit mode and
  // shown (greyed) while editing so they can be toggled back. Children are untouched by pinning.
  const effectiveSectionOrder = editMode ? draftSectionOrder : (sectionOrder ?? []);
  const orderedTop = canCustomise ? orderTopLevelSections(baseItems, effectiveSectionOrder) : baseItems;
  const visibleTop = canCustomise && !editMode ? removeHiddenItems(orderedTop, new Set(hiddenItemIds)) : orderedTop;
  const navItems = visibleTop.map((item) => enrichWithInteractionTracking(item, docked));

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

  // Resolve the active item from the rendered nav first (the canonical copy), falling back to the
  // pinned box. Reference equality then highlights whichever rendered row is the match.
  const activeItem = getActiveItem([...navItems, ...pinnedLeafItems], state.sectionNav.node, location.pathname);

  const isPinned = useCallback(
    (url?: string) => Boolean(url && pinnedUrlsToDisplay.includes(url)),
    [pinnedUrlsToDisplay]
  );

  const persistPinned = (newItems: string[]) => {
    persistBookmarkUrls(newItems, () => setPinnedUrls(newItems));
  };

  const onPinItem = (item: NavModelItem) => {
    const { url } = item;
    if (!url) {
      return;
    }

    // Legacy bookmarks behaviour (flag off): single-url toggle + redux Bookmarks section update.
    if (!canCustomise) {
      const isSaved = isPinned(url);
      const newItems = isSaved ? pinnedUrls.filter((u) => u !== url) : [...pinnedUrls, url];
      reportInteraction(isSaved ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', { path: url });
      persistBookmarkUrls(newItems, () => {
        setPinnedUrls(newItems);
        dispatch(setBookmark({ item, isSaved: !isSaved }));
      });
      return;
    }

    // Customisation on: a plain toggle of the single url (pins stay in the nav and are duplicated
    // into the box). Staged as a draft while editing, otherwise persisted immediately.
    const willPin = !pinnedUrlsToDisplay.includes(url);
    reportInteraction(willPin ? 'grafana_nav_item_pinned' : 'grafana_nav_item_unpinned', { path: url });
    const toggle = (current: string[]) =>
      current.includes(url) ? current.filter((u) => u !== url) : [...current, url];
    if (editMode) {
      setDraftPinnedUrls(toggle);
    } else {
      persistPinned(toggle(pinnedUrls));
    }
  };

  // Hiding works at any depth. Hide adds the item's id (no collapse to the parent); reveal "breaks
  // apart" a hidden ancestor so only this item's path is shown and the rest of the subtree stays hidden.
  const isItemHideable = useCallback((item: NavModelItem) => isHideable(item), []);
  const isHidden = useCallback((item: NavModelItem) => draftHiddenIds.includes(hiddenKey(item)), [draftHiddenIds]);
  const onToggleHidden = useCallback(
    (item: NavModelItem, effectivelyHidden: boolean) => {
      const key = hiddenKey(item);
      if (!key) {
        return;
      }
      setDraftHiddenIds((current) =>
        effectivelyHidden ? revealItem(current, baseItems, key) : hideItem(current, baseItems, key)
      );
    },
    [baseItems]
  );

  // Reset the drafts to the applied state — used both when opening edit mode and when cancelling.
  const syncDraftsFromApplied = useCallback(() => {
    setDraftHiddenIds(hiddenItemIds);
    setDraftPinnedUrls(pinnedUrls);
    setDraftSectionOrder(sectionOrder ?? []);
  }, [hiddenItemIds, pinnedUrls, sectionOrder]);

  const onEnterEditMode = useCallback(() => {
    syncDraftsFromApplied();
    setEditMode(true);
  }, [syncDraftsFromApplied]);

  const onCancelEdit = useCallback(() => {
    syncDraftsFromApplied();
    setEditMode(false);
  }, [syncDraftsFromApplied]);

  const onSaveEdit = useCallback(async () => {
    reportInteraction('grafana_nav_customise_saved', {
      hiddenCount: draftHiddenIds.length,
      pinnedCount: draftPinnedUrls.length,
    });
    // Pins persist to preferences (async) — keep editing and show the saving state until it lands.
    setIsSaving(true);
    const ok = await persistBookmarkUrls(draftPinnedUrls, () => setPinnedUrls(draftPinnedUrls));
    setIsSaving(false);
    if (!ok) {
      // The error toast has fired; stay in edit mode so nothing is lost and the user can retry.
      return;
    }
    // Hidden state + section order persist to localStorage once the pins have saved.
    setHiddenItemIds(draftHiddenIds);
    setSectionOrder(draftSectionOrder);
    setEditMode(false);
  }, [draftHiddenIds, draftPinnedUrls, draftSectionOrder, persistBookmarkUrls, setHiddenItemIds, setSectionOrder]);

  // Reorder the pinned entries (staged; persisted on save). Each entry is one pinned url, so this is
  // a plain move within the stored url list.
  const onReorderPinned = useCallback((fromIndex: number, toIndex: number) => {
    reportInteraction('grafana_nav_pinned_reordered');
    setDraftPinnedUrls((current) => moveItem(current, fromIndex, toIndex));
  }, []);

  // Reorder the top-level sections (staged; persisted to localStorage on save).
  const onReorderSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      reportInteraction('grafana_nav_section_reordered');
      setDraftSectionOrder((current) => reorderSections(baseItems, current, fromIndex, toIndex));
    },
    [baseItems]
  );

  // Only offer a reset when there is something staged to reset.
  const canReset = draftHiddenIds.length > 0 || draftPinnedUrls.length > 0 || draftSectionOrder.length > 0;

  // Stage the reset (cleared on save, discarded on cancel) rather than persisting immediately.
  const onResetToDefault = useCallback(() => {
    reportInteraction('grafana_nav_customise_reset');
    setDraftHiddenIds([]);
    setDraftPinnedUrls([]);
    setDraftSectionOrder([]);
  }, []);

  return {
    canCustomise,
    isLoading,
    navItems,
    pinnedEntries,
    activeItem,
    isPinned,
    onPinItem,
    isHideable: isItemHideable,
    isHidden,
    onToggleHidden,
    editMode,
    isSaving,
    canReset,
    onEnterEditMode,
    onCancelEdit,
    onSaveEdit,
    onResetToDefault,
    onReorderPinned,
    onReorderSection,
  };
};
