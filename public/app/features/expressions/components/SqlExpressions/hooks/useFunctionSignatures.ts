import { useEffect, useState } from 'react';

import { type SqlFunctionSignature } from '../SqlEditor/signatureHelp';

/**
 * Lazily loads the SQL function signature metadata, keeping the large table out
 * of the chunk unless the CodeMirror editor is active.
 */
export function useFunctionSignatures(enabled: boolean): SqlFunctionSignature[] | undefined {
  const [functionSignatures, setFunctionSignatures] = useState<SqlFunctionSignature[]>();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    import('../functionSignatures')
      .then(({ FUNCTION_SIGNATURES }) => {
        if (!cancelled) {
          setFunctionSignatures(FUNCTION_SIGNATURES);
        }
      })
      .catch((error) => {
        console.warn('Failed to load SQL function signatures for signature help', error);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return functionSignatures;
}
