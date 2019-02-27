import { Action, ActionTypes } from 'app/core/actions/navModel';
import { NavIndex, NavModelItem } from 'app/types';
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

export const initialState: NavIndex = buildInitialState();

export const navIndexReducer = (state = initialState, action: Action): NavIndex => {
  switch (action.type) {
    case ActionTypes.UpdateNavIndex:
      const newPages = {};
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
