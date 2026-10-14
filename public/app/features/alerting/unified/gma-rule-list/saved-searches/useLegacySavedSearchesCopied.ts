import { useEffect, useState } from 'react';

import { type NameResolvers } from '../legacy-migration/migrationResolve';

import { copyLegacySavedSearchesOnce } from './savedSearchesMigration';

/**
 * Runs the one-time legacy saved-search copy and reports when it's settled. Callers must not
 * mount anything that reads the page's own saved-search collection until this returns true -
 * copying after that read has already happened would leave the read stale until a manual
 * refresh, and reading concurrently with the copy risks observing a half-written collection.
 */
export function useLegacySavedSearchesCopied(resolvers: NameResolvers): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    copyLegacySavedSearchesOnce(resolvers).finally(() => {
      if (alive) {
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [resolvers]);

  return ready;
}
