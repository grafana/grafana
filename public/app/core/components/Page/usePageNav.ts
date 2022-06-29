import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

export function usePageNav(navId?: string, oldProp?: NavModel): NavModel | undefined {
  if (oldProp) {
    return oldProp;
  }

  // Page component is used in so many tests, this simplifies not having to initialize a full redux store and navIndex
  if (!navId || process.env.JEST_WORKER_ID) {
    return;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSelector(createSelector(getNavIndex, (navIndex) => getNavModel(navIndex, navId ?? 'home')));
}

function getNavIndex(store: StoreState) {
  return store.navIndex;
}
