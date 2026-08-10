import { type Action, type LocationDescriptorObject, parsePath } from 'history';
import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { NavigationType, type To, Router } from 'react-router-dom-v5-compat';

import type { LocationService } from '@grafana/runtime';

const NAVIGATION_TYPE: Record<Action, NavigationType> = {
  POP: NavigationType.Pop,
  PUSH: NavigationType.Push,
  REPLACE: NavigationType.Replace,
};

function toHistoryLocation(to: To): LocationDescriptorObject {
  return typeof to === 'string' ? parsePath(to) : to;
}

export function LocationServiceRouter({ service, children }: { service: LocationService; children: ReactNode }) {
  const history = service.getHistory();
  const [state, setState] = useState({
    action: history.action,
    location: history.location,
  });
  useLayoutEffect(
    () =>
      history.listen((location, action) =>
        setState({
          location,
          action,
        })
      ),
    [history]
  );

  const navigator = useMemo(
    () => ({
      createHref: (to: To) => history.createHref(toHistoryLocation(to)),
      go: (delta: number) => history.go(delta),
      push: (to: To, state?: unknown) => history.push(to, state),
      replace: (to: To, state?: unknown) => history.replace(to, state),
    }),
    [history]
  );

  return (
    <Router location={state.location} navigationType={NAVIGATION_TYPE[state.action]} navigator={navigator}>
      {children}
    </Router>
  );
}
