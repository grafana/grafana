import { useEffect, useState } from 'react';

import { isDynamicPalettesLoaded, loadDynamicFieldColorModes } from 'app/features/dynamic-palettes/dynamicPalettes';

export interface UseDynamicFieldColorModesResult {
  loading: boolean;
  error?: Error;
}

export function useDynamicFieldColorModes(): UseDynamicFieldColorModesResult {
  const [loading, setLoading] = useState(!isDynamicPalettesLoaded());
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;

    loadDynamicFieldColorModes()
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error };
}

export function useDynamicPalettesReady(): boolean {
  const [ready, setReady] = useState(isDynamicPalettesLoaded());

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    loadDynamicFieldColorModes().finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}
