import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { userStarsFieldSelector } from 'app/features/stars/utils';

import { groupResourceForStar } from '../kinds';

import { type UrvPlace } from './useUrvState';

const DASHBOARDS = 'dashboard.grafana.app/dashboards';

export interface PlaceScope {
  /** Set when the place limits results to known names. An empty list means nothing matches. */
  names?: string[];
  types?: string[];
  isLoading: boolean;
}

/** `group/kind/name` keys for everything the user starred. */
export function useStarredKeys(): Set<string> {
  const stars = useListStarsQuery(contextSrv.isSignedIn ? { fieldSelector: userStarsFieldSelector() } : skipToken);
  return useMemo(() => {
    const keys = new Set<string>();
    for (const entry of stars.data?.items?.[0]?.spec.resource ?? []) {
      entry.names.forEach((name) => keys.add(`${entry.group}/${entry.kind}/${name}`));
    }
    return keys;
  }, [stars.data]);
}

/**
 * Starred and recently viewed live outside the index, and global search has no `or`,
 * so these places look up names first and search for them.
 */
export function usePlaceScope(place: UrvPlace): PlaceScope {
  const stars = useListStarsQuery(
    place === 'starred' && contextSrv.isSignedIn ? { fieldSelector: userStarsFieldSelector() } : skipToken
  );
  const [recent, setRecent] = useState<string[]>();

  useEffect(() => {
    if (place !== 'recent') {
      return;
    }
    let cancelled = false;
    impressionSrv
      .getDashboardOpened()
      .then((uids) => !cancelled && setRecent(uids))
      .catch(() => !cancelled && setRecent([]));
    return () => {
      cancelled = true;
    };
  }, [place]);

  return useMemo(() => {
    if (place === 'recent') {
      return { names: recent ?? [], types: [DASHBOARDS], isLoading: recent === undefined };
    }
    if (place === 'starred') {
      const names = new Set<string>();
      const types = new Set<string>();
      for (const entry of stars.data?.items?.[0]?.spec.resource ?? []) {
        const groupResource = groupResourceForStar(entry.group, entry.kind);
        if (groupResource && entry.names.length) {
          types.add(groupResource);
          entry.names.forEach((name) => names.add(name));
        }
      }
      return { names: [...names], types: [...types], isLoading: contextSrv.isSignedIn && stars.isLoading };
    }
    return { isLoading: false };
  }, [place, recent, stars.data, stars.isLoading]);
}
