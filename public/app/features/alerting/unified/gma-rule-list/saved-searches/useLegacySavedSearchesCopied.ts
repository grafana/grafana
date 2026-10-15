import { useEffect, useState } from 'react';

import { type NameResolvers } from '../legacy-migration/migrationResolve';

import { copyLegacySavedSearchesOnce } from './savedSearchesMigration';

/** Until true, mount nothing that reads the collection: it may be half-written. */
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
