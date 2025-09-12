import { AnyAction, createAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';

import { NavIndex, NavModel, NavModelItem } from '@grafana/data';
import config from 'app/core/config';

import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';

export const HOME_NAV_ID = 'home';

export function buildInitialState(): NavIndex {
  const navIndex: NavIndex = {};
  const rootNodes = cloneDeep(config.bootData.navTree);
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

export const initialState: NavIndex = {};

export const updateNavIndex = createAction<NavModelItem>('navIndex/updateNavIndex');
// Since the configuration subtitle includes the organization name, we include this action to update the org name if it changes.
export const updateConfigurationSubtitle = createAction<string>('navIndex/updateConfigurationSubtitle');

export const removeNavIndex = createAction<string>('navIndex/removeNavIndex');

export const getItemWithNewSubTitle = (item: NavModelItem, subTitle: string): NavModelItem => ({
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

    return {
      ...state,
      cfg: { ...state.cfg, subTitle },
      datasources: getItemWithNewSubTitle(state.datasources, subTitle),
      correlations: getItemWithNewSubTitle(state.correlations, subTitle),
      users: getItemWithNewSubTitle(state.users, subTitle),
      teams: getItemWithNewSubTitle(state.teams, subTitle),
      plugins: getItemWithNewSubTitle(state.plugins, subTitle),
      'org-settings': getItemWithNewSubTitle(state['org-settings'], subTitle),
    };
  } else if (removeNavIndex.match(action)) {
    delete state[action.payload];
  }

  return state;
};
