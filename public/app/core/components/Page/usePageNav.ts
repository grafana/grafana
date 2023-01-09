import { createSelector } from 'reselect';

import { NavModel } from '@grafana/data';
import { findNavModelItem, getNavModel } from 'app/core/selectors/navBarTree';
import { store } from 'app/store/store';
import { StoreState, useSelector } from 'app/types';

export function usePageNav(navId?: string, oldProp?: NavModel): NavModel | undefined {
  if (oldProp) {
    return oldProp;
  }

  if (!navId) {
    return;
  }

  // Page component is used in so many tests, this simplifies not having to initialize a full redux store
  if (!store) {
    return;
  }

  // TODO: does this selector actually memoize?
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSelector(createSelector(getNavIndex, (navIndex) => getNavModel(navIndex, navId ?? 'home')));
}

export function useNavItem(navId: string) {
  // TODO: does this selector actually memoize?
  return useSelector(createSelector(getNavIndex, (navIndex) => findNavModelItem(navIndex, navId ?? 'home')));
}

function getNavIndex(store: StoreState) {
  return store.navBarTree;
}
