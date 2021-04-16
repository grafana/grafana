import * as React from 'react';
import { setRef } from './setRef';

/**
 * @internal
 */
export function useForkRef<T>(refA: React.Ref<T | null>, refB: React.MutableRefObject<T | null>) {
  /**
   * This will create a new function if the ref props change and are defined.
   * This means react will call the old forkRef with `null` and the new forkRef
   * with the ref. Cleanup naturally emerges from this behavior.
   */
  return React.useMemo(() => {
    if (refA == null && refB == null) {
      return null;
    }
    return (refValue: T) => {
      setRef(refA, refValue);
      setRef(refB, refValue);
    };
  }, [refA, refB]);
}
