import { NavModel } from '@grafana/data';
import { useSelector } from 'app/types';

import { getNavModel } from '../selectors/navModel';

export const useNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state) => state.navIndex);
  return getNavModel(navIndex, id);
};
