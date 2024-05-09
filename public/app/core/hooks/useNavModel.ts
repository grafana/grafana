import { NavModel } from '@grafana/data';
// @todo: replace barrel import path
import { useSelector } from 'app/types/index';

import { getNavModel } from '../selectors/navModel';

export const useNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state) => state.navIndex);
  return getNavModel(navIndex, id);
};
