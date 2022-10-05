import { useLocation } from 'react-router-dom';
import { createSelector } from 'reselect';

import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { store } from 'app/store/store';
import { StoreState, useSelector } from 'app/types';

import { getActiveItem } from '../NavBar/utils';

const selectNavModel = createSelector(
  (state: StoreState) => state.navIndex,
  (state: StoreState) => state.navBarTree,
  (state: StoreState, pathname: string, navId: string) => [pathname, navId],
  (navIndex, navBarTree, [pathname, navId]) => {
    // Falling back to use `navId` in case the page explicitly specifies it.
    // Otherwise just find the active item based on the current path.
    const id = navId || getActiveItem(navBarTree, pathname)?.id || '';

    return getNavModel(navIndex, id);
  }
);

export function usePageNav(navId?: string, oldProp?: NavModel): NavModel | undefined {
  const location = useLocation();

  // Page component is used in so many tests, this simplifies not having to initialize a full redux store
  if (!store) {
    return;
  }

  // Backwards compatibility: if the page constructs the NavModel on it's own (maybe due to having a custom logic), keep using that
  if (oldProp) {
    return oldProp;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSelector((state) => selectNavModel(state, location.pathname, navId || ''));
}
