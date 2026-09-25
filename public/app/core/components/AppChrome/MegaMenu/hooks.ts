import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import { useListPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1';
import { type NavModelItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSelector } from 'app/types/store';

import { contextSrv } from '../../../services/context_srv';

import {
  applyNavCustomization,
  EMPTY_NAV_CUSTOMIZATION,
  enrichWithInteractionTracking,
  getActiveItem,
  hiddenKey,
  isHideable,
  moveNavItem,
  type NavCustomizationState,
  NON_MENU_NAV_IDS,
  removeHiddenItems,
  renameNavItem,
  toggleNavItemHidden,
} from './utils';

/**
 * The pinned/bookmarked nav item urls, used by the standalone Bookmarks page (`/bookmarks`). The
 * mega menu itself doesn't surface pinning any more — see `useNavCustomization` below for the
 * rename/hide/reorder customisation it offers instead.
 */
export const usePinnedItems = () => {
  const k8sPreferences = useListPreferencesQuery(
    contextSrv.user.isSignedIn ? { fieldSelector: `metadata.name=user-${contextSrv.user.uid}` } : skipToken
  );

  const preferences = k8sPreferences.data?.items[0]?.spec;
  const isLoading = k8sPreferences.isLoading;
  const pinnedItems = useMemo(() => preferences?.navbar?.bookmarkUrls || [], [preferences]);

  return { pinnedItems, isLoading };
};

export const NAV_CUSTOMIZATION_STORAGE_KEY = 'grafana.navigation.megamenu.customizations';
export const NAV_CUSTOMIZATION_QUERY_PARAM = 'navCustom';

/**
 * Storage seam for the mega menu customisation (renamed labels, hidden keys, per-parent order) — a
 * single JSON blob in localStorage. Hacky by design: this is a surface for testing different nav
 * labels/ordering, not a production preferences feature.
 */
const useStoredNavCustomization = () => {
  const [stored, setStored] = useLocalStorage<NavCustomizationState>(
    NAV_CUSTOMIZATION_STORAGE_KEY,
    EMPTY_NAV_CUSTOMIZATION
  );
  return { data: stored ?? EMPTY_NAV_CUSTOMIZATION, setData: setStored };
};

/**
 * Owns the mega-menu customisation: renaming, hiding and reordering any top-level or nested nav
 * item. Applied state persists to localStorage (per-browser); a `?navCustom=<json>` query param can
 * seed it once, so a customisation can be shared via a plain URL. Keeps `MegaMenu` a thin renderer.
 */
export const useNavCustomization = () => {
  const navTree = useSelector((state) => state.navBarTree);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const docked = state.megaMenuDocked;

  const canCustomise = contextSrv.isSignedIn;

  const { data: appliedCustomization, setData: setAppliedCustomization } = useStoredNavCustomization();

  // A shared link (?navCustom=<json>) seeds localStorage once on load, so the customisation applies
  // immediately and survives a refresh without needing to keep the query param around.
  const seededFromUrl = useRef(false);
  useEffect(() => {
    if (seededFromUrl.current) {
      return;
    }
    seededFromUrl.current = true;
    const fromUrl = searchParams.get(NAV_CUSTOMIZATION_QUERY_PARAM);
    if (!fromUrl) {
      return;
    }
    try {
      const parsed = JSON.parse(fromUrl);
      setAppliedCustomization({
        renamed: parsed.renamed ?? {},
        hidden: parsed.hidden ?? [],
        order: parsed.order ?? {},
      });
    } catch {
      // Malformed share link — ignore and keep whatever's already stored.
    }
  }, [searchParams, setAppliedCustomization]);

  const [editMode, setEditMode] = useState(false);
  const [draftCustomization, setDraftCustomization] = useState<NavCustomizationState>(appliedCustomization);

  // Base tree without the items the mega menu never lists directly.
  const baseItems = navTree.filter((item) => !NON_MENU_NAV_IDS.has(item.id ?? ''));

  const effective = editMode ? draftCustomization : appliedCustomization;

  const isHidden = useCallback((item: NavModelItem) => effective.hidden.includes(hiddenKey(item)), [effective]);

  const onToggleHidden = useCallback(
    (item: NavModelItem, effectivelyHidden: boolean) => {
      const key = hiddenKey(item);
      // effectivelyHidden means the item is currently hidden, so this toggle reveals it; otherwise it hides it.
      reportInteraction(effectivelyHidden ? 'grafana_nav_item_shown' : 'grafana_nav_item_hidden', {
        path: item.url ?? item.id,
      });
      setDraftCustomization((current) => toggleNavItemHidden(baseItems, current, key, effectivelyHidden));
    },
    [baseItems]
  );

  const onRename = useCallback((item: NavModelItem, text: string) => {
    reportInteraction('grafana_nav_item_renamed', { path: item.url ?? item.id });
    setDraftCustomization((current) => renameNavItem(current, hiddenKey(item), text));
  }, []);

  const onMove = useCallback(
    (item: NavModelItem, direction: -1 | 1) => {
      reportInteraction('grafana_nav_item_reordered', { path: item.url ?? item.id, direction });
      setDraftCustomization((current) => moveNavItem(baseItems, current, hiddenKey(item), direction));
    },
    [baseItems]
  );

  // Nav in the user's order with renames applied; hidden items (any depth) are dropped outside edit
  // mode and shown (greyed) while editing so they can be toggled back.
  const processed = applyNavCustomization(baseItems, effective);
  const visible = editMode ? processed : removeHiddenItems(processed, new Set(effective.hidden));
  const navItems = visible.map((item) => enrichWithInteractionTracking(item, docked));

  const activeItem = getActiveItem(navItems, state.sectionNav.node, location.pathname);

  // --- Edit session lifecycle ---

  const onEnterEditMode = useCallback(() => {
    setDraftCustomization(appliedCustomization);
    setEditMode(true);
  }, [appliedCustomization]);

  const onCancelEdit = useCallback(() => {
    setDraftCustomization(appliedCustomization);
    setEditMode(false);
  }, [appliedCustomization]);

  const onSaveEdit = useCallback(() => {
    setAppliedCustomization(draftCustomization);
    reportInteraction('grafana_nav_customise_saved', {
      hiddenCount: draftCustomization.hidden.length,
      renamedCount: Object.keys(draftCustomization.renamed).length,
    });
    setEditMode(false);
  }, [draftCustomization, setAppliedCustomization]);

  // Only offer a reset when there is something staged to reset.
  const canReset =
    draftCustomization.hidden.length > 0 ||
    Object.keys(draftCustomization.renamed).length > 0 ||
    Object.keys(draftCustomization.order).length > 0;

  const onResetToDefault = useCallback(() => {
    reportInteraction('grafana_nav_customise_reset', {});
    setDraftCustomization(EMPTY_NAV_CUSTOMIZATION);
  }, []);

  // A shareable link reproducing whatever customisation is currently on screen (the staged draft
  // while editing, otherwise the saved one) — a hacky way to pass around nav naming/ordering
  // experiments without a backend.
  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(NAV_CUSTOMIZATION_QUERY_PARAM, JSON.stringify(effective));
    return url.toString();
  }, [effective]);

  return {
    canCustomise,
    navItems,
    activeItem,
    isHideable,
    isHidden,
    onToggleHidden,
    onRename,
    onMove,
    editMode,
    canReset,
    onEnterEditMode,
    onCancelEdit,
    onSaveEdit,
    onResetToDefault,
    shareUrl,
  };
};
