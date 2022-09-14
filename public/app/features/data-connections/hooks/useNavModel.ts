import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { StoreState } from 'app/types/store';

import { ROUTE_BASE_ID } from '../constants';

// We need this utility logic to make sure that the tab with the current URL is marked as active.
// (In case we were using `getNavModel()` from app/core/selectors/navModel, then we would need to set
// the child nav-model-item's ID on the call-site.)
export const useNavModel = () => {
  const { pathname: currentPath } = useLocation();
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const node = navIndex[ROUTE_BASE_ID];
  const main = node;
  const isDefaultRoute = (item: NavModelItem) =>
    currentPath === `/${ROUTE_BASE_ID}` && item.id === 'data-connections-datasources';
  const isItemActive = (item: NavModelItem) => currentPath.startsWith(item.url || '');

  main.children = main.children?.map((item) => ({
    ...item,
    active: isItemActive(item) || isDefaultRoute(item),
  }));

  return {
    node,
    main,
  };
};
