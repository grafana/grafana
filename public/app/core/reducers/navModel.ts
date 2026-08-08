import { type AnyAction, createAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';

import { type NavIndex, type NavModel, type NavModelItem } from '@grafana/data';

import { getInitialNavTree } from '../navtree/buildStaticNavTree';
import { pluginNavLoaded } from '../navtree/state';
import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';

export const HOME_NAV_ID = 'home';

export function buildInitialState(): NavIndex {
  const navIndex: NavIndex = {};
  const rootNodes = cloneDeep(getInitialNavTree());
  const homeNav = rootNodes.find((node) => node.id === HOME_NAV_ID);
  const otherRootNodes = rootNodes.filter((node) => node.id !== HOME_NAV_ID);

  if (homeNav) {
    buildNavIndex(navIndex, [homeNav]);
  }
  // set home as parent for the other rootNodes
  // need to use the translated home node from the navIndex
  buildNavIndex(navIndex, otherRootNodes, navIndex[HOME_NAV_ID]);

  return navIndex;
}

function buildNavIndex(navIndex: NavIndex, children: NavModelItem[], parentItem?: NavModelItem) {
  const translatedChildren: NavModelItem[] = [];

  for (const node of children) {
    const translatedNode: NavModelItem = {
      ...node,
      text: getNavTitle(node.id) ?? node.text,
      subTitle: getNavSubTitle(node.id) ?? node.subTitle,
      emptyMessage: getNavTitle(node.emptyMessageId),
      parentItem: parentItem,
    };

    if (translatedNode.id) {
      navIndex[translatedNode.id] = translatedNode;
    }

    if (translatedNode.children) {
      buildNavIndex(navIndex, translatedNode.children, translatedNode);
    }
    translatedChildren.push(translatedNode);
  }

  // need to update the parentItem children with the new translated children
  if (parentItem) {
    parentItem.children = translatedChildren;
  }

  navIndex['not-found'] = { ...buildWarningNav('Page not found', '404 Error').node };
  navIndex['error'] = { ...buildWarningNav('Page error', 'An unexpected error').node };
}

function buildWarningNav(text: string, subTitle?: string): NavModel {
  const node = {
    text,
    subTitle,
    icon: 'exclamation-triangle' as const,
  };
  return {
    node: node,
    main: node,
  };
}

const initialState: NavIndex = {};

export const updateNavIndex = createAction<NavModelItem>('navIndex/updateNavIndex');
// Since the configuration subtitle includes the organization name, we include this action to update the org name if it changes.
export const updateConfigurationSubtitle = createAction<string>('navIndex/updateConfigurationSubtitle');

const removeNavIndex = createAction<string>('navIndex/removeNavIndex');

const getItemWithNewSubTitle = (item: NavModelItem, subTitle: string): NavModelItem => ({
  ...item,
  parentItem: {
    ...item.parentItem,
    text: item.parentItem?.text ?? '',
    subTitle,
  },
});

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const navIndexReducer = (state: NavIndex = initialState, action: AnyAction): NavIndex => {
  if (updateNavIndex.match(action)) {
    const newPages: NavIndex = {};
    const payload = action.payload;

    function addNewPages(node: NavModelItem) {
      if (node.children) {
        for (const child of node.children) {
          newPages[child.id!] = {
            ...child,
            parentItem: node,
          };
        }
      }
      if (node.parentItem) {
        addNewPages(node.parentItem);
      }
    }
    addNewPages(payload);

    return { ...state, ...newPages };
  } else if (updateConfigurationSubtitle.match(action)) {
    const subTitle = `Organization: ${action.payload}`;
    const next = { ...state };

    if (next.cfg) {
      next.cfg = { ...next.cfg, subTitle };
    }

    // Which of these entries exist varies by permissions, features and deployment;
    // a missing one must not crash the dispatch (it would abort the org-switch reload).
    for (const id of ['datasources', 'correlations', 'users', 'teams', 'plugins', 'org-settings']) {
      if (next[id]) {
        next[id] = getItemWithNewSubTitle(next[id], subTitle);
      }
    }

    return next;
  } else if (removeNavIndex.match(action)) {
    delete state[action.payload];
  } else if (pluginNavLoaded.match(action)) {
    // Rebuild index entries from the merged tree and lay them over the
    // existing state, so entries registered by pages via updateNavIndex
    // survive while every merged node (and its parent chain) is refreshed.
    // A new state object also busts getNavModel's memoization.
    const rootNodes = cloneDeep(action.payload.tree);
    const homeNav = rootNodes.find((node) => node.id === HOME_NAV_ID);
    const otherRootNodes = rootNodes.filter((node) => node.id !== HOME_NAV_ID);
    const mergedIndex: NavIndex = {};
    if (homeNav) {
      buildNavIndex(mergedIndex, [homeNav]);
    }
    buildNavIndex(mergedIndex, otherRootNodes, mergedIndex[HOME_NAV_ID] ?? state[HOME_NAV_ID]);
    return { ...state, ...mergedIndex };
  }

  return state;
};
