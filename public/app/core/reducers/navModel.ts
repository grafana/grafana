import { AnyAction, createAction } from '@reduxjs/toolkit';
import { NavIndex, NavModelItem } from '@grafana/data';

import config from 'app/core/config';

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

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const navIndexReducer = (state: NavIndex = initialState, action: AnyAction): NavIndex => {
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
