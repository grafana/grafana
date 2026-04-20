import { useEffect, useState } from 'react';

import { getPluginEntitlement } from '../api';
import { isMarketplacePlugin } from '../helpers';
import { type CatalogPlugin } from '../types';

export type EntitlementState = {
  entitled: boolean;
  isLoading: boolean;
};

const entitlementCache = new Map<string, boolean>();

export function clearEntitlementCache(): void {
  entitlementCache.clear();
}

function resolveEntitlement(pluginId: string | undefined, isMarketplace: boolean): EntitlementState {
  if (!isMarketplace || pluginId === undefined) {
    return { entitled: false, isLoading: false };
  }
  const cached = entitlementCache.get(pluginId);
  if (cached !== undefined) {
    return { entitled: cached, isLoading: false };
  }
  return { entitled: false, isLoading: true };
}

export function usePluginEntitlement(plugin: CatalogPlugin | undefined): EntitlementState {
  const isMarketplace = plugin !== undefined && isMarketplacePlugin(plugin);
  const pluginId = plugin?.id;

  const [state, setState] = useState<EntitlementState>(() => resolveEntitlement(pluginId, isMarketplace));

  useEffect(() => {
    const resolved = resolveEntitlement(pluginId, isMarketplace);
    setState(resolved);

    if (!resolved.isLoading) {
      return;
    }

    let cancelled = false;
    getPluginEntitlement(pluginId!)
      .then((entitled) => {
        if (!cancelled) {
          entitlementCache.set(pluginId!, entitled);
          setState({ entitled, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ entitled: false, isLoading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pluginId, isMarketplace]);

  return state;
}
