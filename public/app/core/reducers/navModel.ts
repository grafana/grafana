import { Action } from 'app/core/actions/navModel';
import { NavModelItem, NavIndex } from 'app/types';
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
  return state;
};
