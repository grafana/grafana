import { NavModel } from '@grafana/data';

import { usePageNav } from '../components/Page/usePageNav';

// TODO: sort out this being the same as usePageNav
export const useNavModel = (id: string): NavModel => {
  return usePageNav(id)!; // TODO: sort out not-null bang
};
