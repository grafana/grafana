import { useEffect, useState } from 'react';

import { useAsyncReady } from 'app/features/dynamic-options/useAsyncReady';
import { dynamicPalettesLoader } from 'app/features/dynamic-palettes/dynamicPalettes';

export interface UseDynamicFieldColorModesResult {
  loading: boolean;
  error?: Error;
}

export function useDynamicFieldColorModes(): UseDynamicFieldColorModesResult {
  const ready = useAsyncReady(dynamicPalettesLoader);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    dynamicPalettesLoader.load().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { loading: !ready, error };
}

export function useDynamicPalettesReady(): boolean {
  return useAsyncReady(dynamicPalettesLoader);
}
