import { useEffect, useState } from 'react';

import { useTheme2 } from '@grafana/ui';
import { useAsyncReady } from 'app/features/dynamic-options/useAsyncReady';
import { dynamicPalettesLoader } from 'app/features/dynamic-palettes/dynamicPalettes';

export interface UseDynamicFieldColorModesResult {
  loading: boolean;
  error?: Error;
}

export function useDynamicFieldColorModes(): UseDynamicFieldColorModesResult {
  const theme = useTheme2();
  const ready = useAsyncReady(dynamicPalettesLoader, theme);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    dynamicPalettesLoader.load(theme).catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, theme]);

  return { loading: !ready, error };
}

export function useDynamicPalettesReady(): boolean {
  const theme = useTheme2();
  return useAsyncReady(dynamicPalettesLoader, theme);
}
