import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

export function usePageNav(navId?: string, oldProp?: NavModel) {
  return useSelector(createSelector(getNavIndex, (navIndex) => oldProp ?? getNavModel(navIndex, navId ?? 'home')));
}

function getNavIndex(store: StoreState) {
  return store.navIndex;
}
