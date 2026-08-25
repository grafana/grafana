import { useMemo } from 'react';

import { type DataFrame, getFrameMatchers } from '@grafana/data';

import { type Transformation } from '../types';

import { NO_CONFIGS, precedingTransformations, useTransformedFrames } from './useTransformedFrames';

interface UseTransformationDebugDataOptions {
  selectedTransformation: Transformation | null;
  transformations: Transformation[];
  data: DataFrame[];
  isActive: boolean;
}

interface TransformationDebugData {
  input: DataFrame[];
  output: DataFrame[];
}

/** Stable identity, so a closed drawer does not re-render everything reading this. */
const NO_DEBUG_DATA: TransformationDebugData = { input: [], output: [] };

/**
 * Replays the pipeline around the selected transformation for the debug view: input is everything
 * before it (filtered), output is after it runs.
 *
 * @returns Empty arrays if not active or transformation not found
 */
export function useTransformationDebugData({
  selectedTransformation,
  transformations,
  data,
  isActive,
}: UseTransformationDebugDataOptions): TransformationDebugData {
  // The guard produces the value it guards, so the callers below narrow on one check rather than
  // re-testing for null inside each of them.
  const debugTarget =
    isActive &&
    selectedTransformation !== null &&
    data.length > 0 &&
    transformations.some(({ transformId }) => transformId === selectedTransformation.transformId)
      ? selectedTransformation
      : null;

  const inputConfigs = useMemo(
    () => (debugTarget ? precedingTransformations(debugTarget, transformations) : NO_CONFIGS),
    [debugTarget, transformations]
  );

  const selfConfigs = useMemo(() => (debugTarget ? [debugTarget.transformConfig] : NO_CONFIGS), [debugTarget]);

  // Piped through the preceding stage's own output rather than replayed from `data` alongside it.
  // Two replays from `data` would run every preceding transformation a second time, and would leave
  // the two panes free to settle on different generations.
  const inputFrames = useTransformedFrames(inputConfigs, data);
  const outputFrames = useTransformedFrames(selfConfigs, inputFrames);

  return useMemo(() => {
    if (!debugTarget) {
      return NO_DEBUG_DATA;
    }

    // The debugged transformation only sees the frames its own filter admits. `transformDataFrame`
    // applies that filter itself, so only the displayed input is narrowed here.
    const filter = debugTarget.transformConfig.filter;
    const matcher = filter?.options ? getFrameMatchers(filter) : undefined;

    return {
      input: matcher ? inputFrames.filter((frame) => matcher(frame)) : inputFrames,
      output: outputFrames,
    };
  }, [debugTarget, inputFrames, outputFrames]);
}
