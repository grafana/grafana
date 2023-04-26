import { useEffect, useRef } from 'react';

import { stopQueryState } from 'app/core/utils/explore';
import { useSelector } from 'app/types';

import { selectPanes } from '../state/selectors';

/**
 * Unsubscribe from queries when unmounting.
 * This avoids unnecessary state changs when navigating away from Explore.
 */
export function useStopQueries() {
  const panesRef = useRef<ReturnType<typeof selectPanes>>({});
  panesRef.current = useSelector(selectPanes);

  useEffect(() => {
    return () => {
      for (const [, pane] of Object.entries(panesRef.current)) {
        stopQueryState(pane.querySubscription);
      }
    };
  }, []);
}
