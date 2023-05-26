import { useCallback, useState } from 'react';

import { ViewRangeTimeUpdate, ViewRange } from './components';

/**
 * Controls state of the zoom function that can be used through minimap in header or on the timeline. ViewRange contains
 * state not only for current range that is showing but range that is currently being selected by the user.
 */
export function useViewRange() {
  const [viewRange, setViewRange] = useState<ViewRange>({
    time: {
      current: [0, 1],
    },
  });

  const updateNextViewRangeTime = useCallback(function updateNextViewRangeTime(update: ViewRangeTimeUpdate) {
    setViewRange((prevRange): ViewRange => {
      const time = { ...prevRange.time, ...update };
      return { ...prevRange, time };
    });
  }, []);

  const updateViewRangeTime = useCallback(function updateViewRangeTime(start: number, end: number) {
    const current: [number, number] = [start, end];
    const time = { current };
    setViewRange((prevRange): ViewRange => {
      return { ...prevRange, time };
    });
  }, []);

  return { viewRange, updateViewRangeTime, updateNextViewRangeTime };
}
