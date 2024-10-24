import * as H from 'history';
import { pick } from 'lodash';

import { NavLinkDTO } from '@grafana/data';

export function isSoloRoute(path: string): boolean {
  return /(d-solo|dashboard-solo)/.test(path?.toLowerCase());
}

export function pluginHasRootPage(pluginId: string, navTree: NavLinkDTO[]): boolean {
  return Boolean(
    navTree
      .find((navLink) => navLink.id === 'apps')
      ?.children?.find((app) => app.id === `plugin-page-${pluginId}`)
      ?.children?.some((page) => page.url?.endsWith(`/a/${pluginId}`))
  );
}

type LocalStorageHistoryOptions = {
  storageKey: string;
};

/**
 * Simple wrapper over the memory history that persists the location in the localStorage.
 * @param options
 */
export function createLocationStorageHistory(options: LocalStorageHistoryOptions): H.MemoryHistory {
  const storedLocation = localStorage.getItem(options.storageKey);
  const initialEntry = storedLocation ? JSON.parse(storedLocation) : '/';

  const memoryHistory = H.createMemoryHistory({ initialEntries: [initialEntry] });

  // We have to check whether location was actually changed by this way because the function don't actually offer
  // a return value that would tell us whether the change was successful or not and there are a few ways where the
  // actual location change could be blocked.
  let currentLocation = memoryHistory.location;
  function maybeUpdateLocation() {
    if (memoryHistory.location !== currentLocation) {
      localStorage.setItem(
        options.storageKey,
        JSON.stringify(pick(memoryHistory.location, 'pathname', 'search', 'hash'))
      );
      currentLocation = memoryHistory.location;
    }
  }

  // This creates a sort of proxy over the memory location just to add the localStorage persistence. We could achieve
  // the same effect by a listener but that would create a memory leak as there would be no reasonable way to
  // unsubcribe the listener later on.
  return {
    get index() {
      return memoryHistory.index;
    },
    get entries() {
      return memoryHistory.entries;
    },
    canGo(n: number) {
      return memoryHistory.canGo(n);
    },
    get length() {
      return memoryHistory.length;
    },
    get action() {
      return memoryHistory.action;
    },
    get location() {
      return memoryHistory.location;
    },
    push(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.push(location, state);
      maybeUpdateLocation();
    },
    replace(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.replace(location, state);
      maybeUpdateLocation();
    },
    go(n: number) {
      memoryHistory.go(n);
      maybeUpdateLocation();
    },
    goBack() {
      memoryHistory.goBack();
      maybeUpdateLocation();
    },
    goForward() {
      memoryHistory.goForward();
      maybeUpdateLocation();
    },
    block(prompt?: boolean | string | H.TransitionPromptHook<H.LocationState>) {
      return memoryHistory.block(prompt);
    },
    listen(listener: H.LocationListener<H.LocationState>) {
      return memoryHistory.listen(listener);
    },
    createHref(location: H.LocationDescriptorObject<H.LocationState>) {
      return memoryHistory.createHref(location);
    },
  };
}
