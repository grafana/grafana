import { useEffect } from 'react';
import { Subject } from 'rxjs';

import { NavModelItem } from '@grafana/data';

export interface TopNavProps {
  subNav?: NavModelItem;
  actions?: React.ReactNode;
}

export const topNavUpdates = new Subject<TopNavProps>();
export const topNavDefaultProps: TopNavProps = {};

/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export function TopNavUpdate(props: TopNavProps) {
  useEffect(() => {
    topNavUpdates.next(props);
  });
  return null;
}
