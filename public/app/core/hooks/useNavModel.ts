import { useSelector } from 'react-redux';

import { NavModel } from '@grafana/data';
import { StoreState } from 'app/types/store';

import { getNavModel } from '../selectors/navModel';

export const useNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  return getNavModel(navIndex, id);
};
