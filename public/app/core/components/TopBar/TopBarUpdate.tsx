import { useEffect } from 'react';
import { Subject } from 'rxjs';

export interface TopBarProps {
  title: string;
  actions?: React.ReactNode;
}

export const topBarUpdates = new Subject<TopBarProps>();
export const topBarDefaultProps: TopBarProps = {
  title: 'Home',
};

/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export function TopBarUpdate(props: TopBarProps) {
  useEffect(() => {
    topBarUpdates.next(props);
  });
  return null;
}
