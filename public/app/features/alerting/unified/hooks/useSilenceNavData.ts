import { useEffect, useState } from 'react';
import { useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell-slash',
};

export function useSilenceNavData() {
  const { isExact, path } = useRouteMatch();
  const [pageNav, setPageNav] = useState<NavModelItem | undefined>();

  useEffect(() => {
    if (path === '/alerting/silence/new') {
      setPageNav({
        ...defaultPageNav,
        id: 'silence-new',
        text: 'Silence alert rule',
        subTitle: 'Configure silences to stop notifications from a particular alert rule',
      });
    } else if (path === '/alerting/silence/:id/edit') {
      setPageNav({
        ...defaultPageNav,
        id: 'silence-edit',
        text: 'Edit silence',
        subTitle: 'Recreate existing silence to stop notifications from a particular alert rule',
      });
    }
  }, [path, isExact]);

  return pageNav;
}
