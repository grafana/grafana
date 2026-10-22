import { useMemo } from 'react';

import { type InterpolateFunction } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

/**
 * ${__theme} reads the current theme, which no other render input reflects. A new
 * function per theme re-runs every render cached on replaceVariables when it changes.
 */
export function useThemedReplaceVariables(replaceVariables: InterpolateFunction): InterpolateFunction {
  const theme = useTheme2();

  return useMemo(
    () =>
      (...args: Parameters<InterpolateFunction>) =>
        replaceVariables(...args),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replaceVariables, theme]
  );
}
