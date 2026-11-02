import { type NavModelItem } from '@grafana/data';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

/**
 * Returns the home nav item.
 */
export function useHomeNav(): NavModelItem | undefined {
  return useSelector((state) => state.navIndex[HOME_NAV_ID]);
}
