import { type Action, type LocationDescriptorObject, parsePath } from 'history';
import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
// react-router-dom-v5-compat re-exports react-router@v6, not @v5.
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

/**
 * LocationServiceRouter glues `locationService` to react-router@v6.
 *
 * react-router usually creates and owns the browser history. Grafana supplies
 * its own instead. `HistoryWrapper` in `@grafana/runtime` wraps a patched history@v4 instance,
 * and adds `orgId` to every URL it builds. This component gives the router a `Navigator` that sends
 * navigation back to that history, so `orgId` survives links and redirects.
 *
 * Most of this was lifted from the react-router-dom-v5-compat `CompatRouter` component which we need
 * to remove to complete the react-router@v6 migration. `CompatRouter` also put children in a catch-all
 * route (`path="*"`). This component does not.
 * This difference only affects `useParams()['*']` at the root. Relative links still resolve because
 * react-router falls back to `/` when no route matched. App plugins still get the parameter because every
 * route in `app/features/plugins/routes.tsx` ends in `/*`.
 */
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
