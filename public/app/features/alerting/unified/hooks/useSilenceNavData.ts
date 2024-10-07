import { useEffect, useState } from 'react';
import { useMatch } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell-slash',
};

export function useSilenceNavData() {
  const [pageNav, setPageNav] = useState<NavModelItem | undefined>();
  const isNewPath = useMatch('/alerting/silence/new');
  const isEditPath = useMatch('/alerting/silence/:id/edit');

  useEffect(() => {
    if (isNewPath) {
      setPageNav({
        ...defaultPageNav,
        id: 'silence-new',
        text: 'Silence alert rule',
        subTitle: 'Configure silences to stop notifications from a particular alert rule',
      });
    } else if (isEditPath) {
      setPageNav({
        ...defaultPageNav,
        id: 'silence-edit',
        text: 'Edit silence',
        subTitle: 'Recreate existing silence to stop notifications from a particular alert rule',
      });
    }
  }, [isEditPath, isNewPath]);

  return pageNav;
}
