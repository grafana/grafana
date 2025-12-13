import { isEqual } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

import { usePluginContext } from '@grafana/data';
import { UsePluginLinksOptions, UsePluginLinksResult } from '@grafana/runtime';

import { getObservablePluginLinks } from './getPluginExtensions';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { getExtensionPointPluginDependencies, getReadOnlyProxy, useExtensionPointLog } from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

// Returns an array of link extensions for the given extension point
export function usePluginLinks({
  limitPerPlugin,
  extensionPointId,
  context: contextProp,
}: UsePluginLinksOptions): UsePluginLinksResult {
  // Context:
  // - protecting against inline object definitions at the call-site
  // - protecting against mutating the common context object by freezing it
  const pluginContext = usePluginContext();
  const prevContext = useRef<typeof contextProp>();
  const [context, setContext] = useState<typeof contextProp>();
  // Preloading app plugins that register links to this extension point
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));
  const extensionPointLog = useExtensionPointLog(extensionPointId);

  // Context object equality check
  // (Ideally the callsite passes in a memoized object, or an object that doesn't change between rerenders.)
  useEffect(() => {
    if (prevContext.current === undefined || !isEqual(prevContext.current, contextProp)) {
      prevContext.current = contextProp;
      setContext(getReadOnlyProxy(contextProp ?? {}));
    }
  }, [contextProp]);

  // Extension point validation
  const { result: validationResult } = useMemo(
    () =>
      validateExtensionPoint({
        extensionPointId,
        pluginContext,
        isLoadingAppPlugins,
        extensionPointLog,
      }),
    [extensionPointId, extensionPointLog, pluginContext, isLoadingAppPlugins]
  );

  // Create observable for plugin links that emits incrementally as configure() functions resolve
  const observableLinks = useMemo(() => {
    if (validationResult) {
      // Return empty observable if validation failed
      return of([]);
    }
    return getObservablePluginLinks({
      extensionPointId,
      context,
      limitPerPlugin,
    });
  }, [extensionPointId, context, limitPerPlugin, validationResult]);

  // Subscribe to the observable - this will rerender as each configure() function resolves
  const links = useObservable(observableLinks, []);

  // Determine loading state
  // We're loading if:
  // 1. App plugins are still loading
  // 2. Validation is in progress
  // Note: Links with async configure() functions will appear incrementally as they resolve,
  // so we don't need to track individual loading states - the observable handles this.
  const isLoading = (validationResult?.isLoading ?? false) || isLoadingAppPlugins;

  return {
    isLoading,
    links: validationResult ? [] : links,
  };
}
