import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';
import { getNavModel } from '../selectors/navModel';
import { NavModel } from '../core';

export const useNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  return getNavModel(navIndex, id);
};
