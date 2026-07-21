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

import { getNavExperimentPayload, reportNavExperimentViewOnce, setNavExperimentVariant } from './navExperiment';
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
  type PinnedEntry,
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
 * Storage seam for the user's top-level section order. Backed by localStorage today (per-browser),
 * but shaped like an RTK query hook so swapping in a preferences-API-backed impl later is a drop-in.
 */
const useSectionOrder = (): { data: string[]; isLoading: boolean; setSectionOrder: (ids: string[]) => void } => {
  const [stored, setStored] = useLocalStorage<string[]>(SECTION_ORDER_STORAGE_KEY, []);
  return { data: stored ?? [], isLoading: false, setSectionOrder: setStored };
};

// The shared shape each customisation dimension (pinning, hiding, ordering) exposes to the
// orchestrator: staged edits live in a draft until the edit session is saved or cancelled.
interface CustomisationDimension {
  /** Reset the draft to the applied state (on entering or cancelling an edit session). */
  syncFromApplied: () => void;
  /** Clear the draft back to defaults (staged; persisted on save). */
  reset: () => void;
  /** Persist the draft to the applied store. Pinning is async and may fail; the others are sync. */
  commit: () => void | Promise<boolean>;
}

/**
 * Pinning, for both the customise flow (staged drafts) and the legacy flag-off bookmarks. Owns the
 * applied pinned urls (a local copy, since the patch mutation doesn't invalidate the query), the
 * staged draft, and persistence to the preferences API.
 */
const usePinning = ({
  canCustomise,
  editMode,
}: {
  canCustomise: boolean;
  editMode: boolean;
}): CustomisationDimension & {
  pinnedItems: string[];
  effectivePinnedUrls: string[];
  draftPinnedUrls: string[];
  isLoading: boolean;
  isPinned: (url?: string) => boolean;
  onPinItem: (item: NavModelItem) => void;
  onReorderPinned: (fromIndex: number, toIndex: number) => void;
  commit: () => Promise<boolean>;
} => {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const [patchPreferences] = usePatchUserPreferencesMutation();
  const [patchPreferencesK8s] = useUpdatePreferencesMutation();
  const { pinnedItems, isLoading } = usePinnedItems();

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

  const effectivePinnedUrls = editMode ? draftPinnedUrls : pinnedUrls;
  const isPinned = useCallback(
    (url?: string) => Boolean(url && effectivePinnedUrls.includes(url)),
    [effectivePinnedUrls]
  );

  const onPinItem = (item: NavModelItem) => {
    const { url } = item;
    if (!url) {
      return;
    }

    // Legacy bookmarks behaviour (flag off): single-url toggle + redux Bookmarks section update.
    if (!canCustomise) {
      const isSaved = isPinned(url);
      const newItems = isSaved ? pinnedUrls.filter((i) => url !== i) : [...pinnedUrls, url];
      reportInteraction(isSaved ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned', {
        path: url,
        ...getNavExperimentPayload(),
      });
      persistBookmarkUrls(newItems, () => {
        setPinnedUrls(newItems);
        dispatch(setBookmark({ item, isSaved: !isSaved }));
      });
      return;
    }

    // Customisation on: a plain toggle of the single url, staged as a draft (pins stay in the nav and
    // are duplicated into the box). The pin controls only render in edit mode, so this always stages.
    const willPin = !effectivePinnedUrls.includes(url);
    reportInteraction(willPin ? 'grafana_nav_item_pinned' : 'grafana_nav_item_unpinned', {
      path: url,
      ...getNavExperimentPayload(),
    });
    setDraftPinnedUrls((current) => (current.includes(url) ? current.filter((u) => u !== url) : [...current, url]));
  };

  // Reorder the pinned entries (staged; persisted on save). Each entry is one pinned url, so this is
  // a plain move within the stored url list.
  const onReorderPinned = useCallback((fromIndex: number, toIndex: number) => {
    reportInteraction('grafana_nav_pinned_reordered');
    setDraftPinnedUrls((current) => moveItem(current, fromIndex, toIndex));
  }, []);

  const syncFromApplied = useCallback(() => setDraftPinnedUrls(pinnedUrls), [pinnedUrls]);
  const reset = useCallback(() => setDraftPinnedUrls([]), []);
  const commit = useCallback(
    () => persistBookmarkUrls(draftPinnedUrls, () => setPinnedUrls(draftPinnedUrls)),
    [draftPinnedUrls, persistBookmarkUrls]
  );

  return {
    pinnedItems,
    effectivePinnedUrls,
    draftPinnedUrls,
    isLoading,
    isPinned,
    onPinItem,
    onReorderPinned,
    syncFromApplied,
    reset,
    commit,
  };
};

/** Hiding of nav items at any depth. Owns the applied hidden-id set, the staged draft, and the
 * hide/reveal toggle. Applied ids prune the nav outside edit mode; the draft greys rows while editing. */
const useHiddenSections = ({
  baseItems,
}: {
  baseItems: NavModelItem[];
}): CustomisationDimension & {
  appliedHiddenIds: string[];
  draftHiddenIds: string[];
  isLoading: boolean;
  isHidden: (item: NavModelItem) => boolean;
  onToggleHidden: (item: NavModelItem, effectivelyHidden: boolean) => void;
} => {
  const { data: appliedHiddenIds, isLoading, setHiddenItemIds } = useHiddenItems();
  const [draftHiddenIds, setDraftHiddenIds] = useState<string[]>(appliedHiddenIds);

  // Hiding works at any depth. Hide adds the item's id (no collapse to the parent); reveal "breaks
  // apart" a hidden ancestor so only this item's path is shown and the rest of the subtree stays hidden.
  const isHidden = useCallback((item: NavModelItem) => draftHiddenIds.includes(hiddenKey(item)), [draftHiddenIds]);
  const onToggleHidden = useCallback(
    (item: NavModelItem, effectivelyHidden: boolean) => {
      const key = hiddenKey(item);
      setDraftHiddenIds((current) =>
        effectivelyHidden ? revealItem(current, baseItems, key) : hideItem(current, baseItems, key)
      );
    },
    [baseItems]
  );

  const syncFromApplied = useCallback(() => setDraftHiddenIds(appliedHiddenIds), [appliedHiddenIds]);
  const reset = useCallback(() => setDraftHiddenIds([]), []);
  const commit = useCallback(() => setHiddenItemIds(draftHiddenIds), [draftHiddenIds, setHiddenItemIds]);

  return { appliedHiddenIds, draftHiddenIds, isLoading, isHidden, onToggleHidden, syncFromApplied, reset, commit };
};

/** Top-level section ordering. Owns the applied order, the staged draft, and the drag-reorder. */
const useSectionOrdering = ({
  editMode,
  baseItems,
}: {
  editMode: boolean;
  baseItems: NavModelItem[];
}): CustomisationDimension & {
  effectiveSectionOrder: string[];
  draftSectionOrder: string[];
  isLoading: boolean;
  onReorderSection: (fromIndex: number, toIndex: number) => void;
} => {
  const { data: appliedSectionOrder, isLoading, setSectionOrder } = useSectionOrder();
  const [draftSectionOrder, setDraftSectionOrder] = useState<string[]>(appliedSectionOrder);

  const effectiveSectionOrder = editMode ? draftSectionOrder : appliedSectionOrder;

  const onReorderSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      reportInteraction('grafana_nav_section_reordered');
      setDraftSectionOrder((current) => reorderSections(baseItems, current, fromIndex, toIndex));
    },
    [baseItems]
  );

  const syncFromApplied = useCallback(() => setDraftSectionOrder(appliedSectionOrder), [appliedSectionOrder]);
  const reset = useCallback(() => setDraftSectionOrder([]), []);
  const commit = useCallback(() => setSectionOrder(draftSectionOrder), [draftSectionOrder, setSectionOrder]);

  return { effectiveSectionOrder, draftSectionOrder, isLoading, onReorderSection, syncFromApplied, reset, commit };
};

/**
 * Owns the mega-menu customisation behaviour (behind the `grafana.customizableMegaMenu` flag):
 * reordering top-level sections, pinning any non-top-level item (surfaced as a duplicate in the
 * pinned box), and hiding items — plus the legacy (flag-off) bookmarks behaviour. Composes a hook
 * per dimension (pinning/hiding/ordering) and coordinates the edit session (enter/cancel/save/reset)
 * and the derived nav structures, keeping `MegaMenu` a thin renderer.
 */
export const useNavCustomization = () => {
  const navTree = useSelector((state) => state.navBarTree);
  const location = useLocation();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const docked = state.megaMenuDocked;

  const customizableMegaMenu = useBooleanFlagValue('grafana.customizableMegaMenu', false);
  const canCustomise = customizableMegaMenu && contextSrv.isSignedIn;

  // A/B experiment instrumentation: with a boolean flag, "treatment" = flag on, "control" = flag
  // off. Cache the variant so the KPI interactions can be stamped with it, and fire the exposure
  // (denominator) event once per page load for the experiment population (signed-in users).
  const variant = customizableMegaMenu ? 'treatment' : 'control';
  useEffect(() => {
    if (!contextSrv.isSignedIn) {
      return;
    }
    setNavExperimentVariant(variant);
    reportNavExperimentViewOnce(variant);
  }, [variant]);

  const [editMode, setEditMode] = useState(false);
  // Set while the Save (Done) preferences write is in flight, so the control can show a spinner.
  const [isSaving, setIsSaving] = useState(false);

  // Base tree without the items the mega menu never lists directly. When customisation is on, the
  // dedicated Bookmarks section is also dropped — pinned items are re-presented in the pinned box.
  const baseItems = navTree.filter(
    (item) => !NON_MENU_NAV_IDS.has(item.id ?? '') && !(canCustomise && item.id === 'bookmarks')
  );

  const {
    pinnedItems,
    effectivePinnedUrls,
    draftPinnedUrls,
    isLoading: pinningLoading,
    isPinned,
    onPinItem,
    onReorderPinned,
    syncFromApplied: syncPinning,
    reset: resetPinning,
    commit: commitPinning,
  } = usePinning({ canCustomise, editMode });
  const {
    appliedHiddenIds,
    draftHiddenIds,
    isLoading: hidingLoading,
    isHidden,
    onToggleHidden,
    syncFromApplied: syncHiding,
    reset: resetHiding,
    commit: commitHiding,
  } = useHiddenSections({ baseItems });
  const {
    effectiveSectionOrder,
    draftSectionOrder,
    isLoading: orderingLoading,
    onReorderSection,
    syncFromApplied: syncOrdering,
    reset: resetOrdering,
    commit: commitOrdering,
  } = useSectionOrdering({ editMode, baseItems });

  // Render a skeleton until the customisation state has loaded on first visit, so the menu doesn't
  // render then reflow (pins appearing). Cached after that.
  const isLoading = canCustomise && (pinningLoading || hidingLoading || orderingLoading);

  // Pinned box: one breadcrumb entry per pinned url (in the user's order). Pinning duplicates items
  // here; the main nav below is never pruned. Leaf items are enriched so clicks are tracked.
  const pinnedEntries: PinnedEntry[] = (canCustomise ? getPinnedEntries(baseItems, effectivePinnedUrls) : []).map(
    (entry) =>
      entry.section
        ? { url: entry.url, section: enrichWithInteractionTracking(entry.section, docked) }
        : { url: entry.url, line: { ...entry.line, item: enrichWithInteractionTracking(entry.line.item, docked) } }
  );
  // The pinned items (a section header plus its children, or a normal pin's leaf), for active-item
  // resolution alongside the nav. Section children come from the section node itself, so they're the
  // same enriched objects the rendered rows use.
  const pinnedLeafItems = pinnedEntries.flatMap((entry) =>
    entry.section ? [entry.section, ...(entry.section.children ?? [])] : [entry.line.item]
  );

  // Top-level nav in the user's order; hidden items (any depth) are dropped outside edit mode and
  // shown (greyed) while editing so they can be toggled back. Children are untouched by pinning.
  const orderedTop = canCustomise ? orderTopLevelSections(baseItems, effectiveSectionOrder) : baseItems;
  const visibleTop = canCustomise && !editMode ? removeHiddenItems(orderedTop, new Set(appliedHiddenIds)) : orderedTop;
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

  // --- Edit session lifecycle ---

  // Reset every dimension's draft to its applied state — used on entering and on cancelling.
  const syncDraftsFromApplied = useCallback(() => {
    syncPinning();
    syncHiding();
    syncOrdering();
  }, [syncPinning, syncHiding, syncOrdering]);

  const onEnterEditMode = useCallback(() => {
    syncDraftsFromApplied();
    setEditMode(true);
  }, [syncDraftsFromApplied]);

  const onCancelEdit = useCallback(() => {
    syncDraftsFromApplied();
    setEditMode(false);
  }, [syncDraftsFromApplied]);

  const onSaveEdit = useCallback(async () => {
    // Pins persist to preferences (async) — keep editing and show the saving state until it lands.
    setIsSaving(true);
    const ok = await commitPinning();
    setIsSaving(false);
    if (!ok) {
      // The error toast has fired; stay in edit mode so nothing is lost and the user can retry.
      return;
    }
    // Hidden state + section order persist (localStorage) once the pins have saved.
    commitHiding();
    commitOrdering();
    // Report only after everything has persisted, so a failed save isn't recorded as a success.
    reportInteraction('grafana_nav_customise_saved', {
      hiddenCount: draftHiddenIds.length,
      pinnedCount: draftPinnedUrls.length,
    });
    setEditMode(false);
  }, [commitPinning, commitHiding, commitOrdering, draftHiddenIds, draftPinnedUrls]);

  // Only offer a reset when there is something staged to reset.
  const canReset = draftPinnedUrls.length > 0 || draftHiddenIds.length > 0 || draftSectionOrder.length > 0;

  // Stage the reset (cleared on save, discarded on cancel) rather than persisting immediately.
  const onResetToDefault = useCallback(() => {
    reportInteraction('grafana_nav_customise_reset');
    resetPinning();
    resetHiding();
    resetOrdering();
  }, [resetPinning, resetHiding, resetOrdering]);

  return {
    canCustomise,
    isLoading,
    navItems,
    pinnedEntries,
    activeItem,
    isPinned,
    onPinItem,
    isHideable,
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
