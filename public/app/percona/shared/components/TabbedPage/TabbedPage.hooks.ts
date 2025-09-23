import { NavModel } from '@grafana/data';
import { usePageNav } from 'app/core/components/Page/usePageNav';

export const useTabs = (navId?: string, oldProp?: NavModel) => {
  const navModel = usePageNav(navId, oldProp);
  return navModel?.main?.children || [];
};
