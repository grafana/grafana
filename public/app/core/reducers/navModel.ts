import { NavIndex, NavModelItem } from '@grafana/data';
import config from 'app/core/config';
import { Action, createAction } from '@reduxjs/toolkit';

export function buildInitialState(): NavIndex {
  const navIndex: NavIndex = {};
  const rootNodes = config.bootData.navTree as NavModelItem[];
  buildNavIndex(navIndex, rootNodes);
  return navIndex;
}

function buildNavIndex(navIndex: NavIndex, children: NavModelItem[], parentItem?: NavModelItem) {
  for (const node of children) {
    navIndex[node.id] = {
      ...node,
      parentItem: parentItem,
    };

    if (node.children) {
      buildNavIndex(navIndex, node.children, node);
    }
  }
}

export const initialState: NavIndex = {};

export const updateNavIndex = createAction<NavModelItem>('navIndex/updateNavIndex');

export const navIndexReducer = (state: NavIndex = initialState, action: Action<unknown>): NavIndex => {
  if (updateNavIndex.match(action)) {
    const newPages: NavIndex = {};
    const payload = action.payload;

    for (const node of payload.children) {
      newPages[node.id] = {
        ...node,
        parentItem: payload,
      };
    }

    return { ...state, ...newPages };
  }

  return state;
};
