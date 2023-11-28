import { useMemo } from 'react';
import { useCounter, usePrevious } from 'react-use';

import { DataFrame, compareArrayValues, compareDataFrameStructures } from '@grafana/data';

export function useStructureRev(frames: DataFrame[]) {
  const [structureRev, { inc }] = useCounter(0);
  const previousFrames = usePrevious(frames);

  // We need to increment structureRev when the number of series changes.
  // the function passed to useMemo runs during rendering, so when we get a different
  // amount of data, structureRev is incremented before we render it
  useMemo(() => {
    if (previousFrames && !compareArrayValues(frames, previousFrames, compareDataFrameStructures)) {
      inc();
    }
  }, [frames, previousFrames, inc]);

  return structureRev;
}
