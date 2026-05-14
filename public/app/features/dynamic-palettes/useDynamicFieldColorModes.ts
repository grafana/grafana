import { useEffect, useState } from 'react';

import { useTheme2 } from '@grafana/ui';
import { isDynamicPalettesLoaded, loadDynamicFieldColorModes } from 'app/features/dynamic-palettes/dynamicPalettes';

export interface UseDynamicFieldColorModesResult {
  loading: boolean;
  error?: Error;
}

export function useDynamicFieldColorModes(): UseDynamicFieldColorModesResult {
  const [loading, setLoading] = useState(!isDynamicPalettesLoaded());
  const [error, setError] = useState<Error | undefined>();
  const theme = useTheme2();

  useEffect(() => {
    let cancelled = false;

    loadDynamicFieldColorModes(theme)
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
  }, [theme]);

  return { loading, error };
}

export function useDynamicPalettesReady(): boolean {
  const [ready, setReady] = useState(isDynamicPalettesLoaded());
  const theme = useTheme2();

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    loadDynamicFieldColorModes(theme).finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, theme]);

  return ready;
}
