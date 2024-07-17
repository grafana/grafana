import { useCallback } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';
import windowSplitSlice from 'app/core/reducers/windowSplit';

import { useDispatch, useSelector } from '../../../types';

import { getPluginExtensions } from './getPluginExtensions';
import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';

export function createUsePluginExtensions(extensionsRegistry: ReactivePluginExtensionsRegistry) {
  const observableRegistry = extensionsRegistry.asObservable();
  const cache: {
    id: string;
    extensions: Record<string, { context: GetPluginExtensionsOptions['context']; extensions: PluginExtension[] }>;
  } = {
    id: '',
    extensions: {},
  };

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const registry = useObservable(observableRegistry);
    const secondAppId = useSelector((state) => state.windowSplit.secondAppId);
    let mainApp = window.location.pathname.match(/\/a\/([^/]+)/)?.[1];
    if (!mainApp && window.location.pathname.match(/\/explore/)) {
      mainApp = 'explore';
    }

    if (!mainApp && window.location.pathname.match(/\/d\//)) {
      mainApp = 'dashboards';
    }
    const openedApps = [];
    if (mainApp) {
      openedApps.push(mainApp);
    }

    if (secondAppId) {
      openedApps.push(secondAppId);
    }

    const dispatch = useDispatch();
    const openSplitApp = useCallback(
      (appId: string, context: unknown) =>
        dispatch(windowSplitSlice.actions.openSplitApp({ secondAppId: appId, context })),
      [dispatch]
    );

    const closeSplitApp = useCallback(
      (appId: string) => dispatch(windowSplitSlice.actions.closeSplitApp({ secondAppId: appId })),
      [dispatch]
    );

    if (!registry) {
      return { extensions: [], isLoading: false };
    }

    if (registry.id !== cache.id) {
      cache.id = registry.id;
      cache.extensions = {};
    }

    // `getPluginExtensions` will return a new array of objects even if it is called with the same options, as it always constructing a frozen objects.
    // Due to this we are caching the result of `getPluginExtensions` to avoid unnecessary re-renders for components that are using this hook.
    // (NOTE: we are only checking referential equality of `context` object, so it is important to not mutate the object passed to this hook.)
    const key = `${options.extensionPointId}-${options.limitPerPlugin}`;
    if (cache.extensions[key] && cache.extensions[key].context === options.context) {
      return {
        extensions: cache.extensions[key].extensions,
        isLoading: false,
      };
    }

    const { extensions } = getPluginExtensions({ ...options, registry, openedApps, openSplitApp, closeSplitApp });

    cache.extensions[key] = {
      context: options.context,
      extensions,
    };

    return {
      extensions,
      isLoading: false,
    };
  };
}
