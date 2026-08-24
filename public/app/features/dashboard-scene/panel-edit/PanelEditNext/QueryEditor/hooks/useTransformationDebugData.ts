import { useMemo } from 'react';

import { type DataFrame, getFrameMatchers } from '@grafana/data';

import { type Transformation } from '../types';

import {
  NO_CONFIGS,
  precedingTransformations,
  type TransformationConfigs,
  useTransformedFrames,
} from './useTransformedFrames';

interface UseTransformationDebugDataOptions {
  selectedTransformation: Transformation | null;
  transformations: Transformation[];
  systemTransformations: TransformationConfigs;
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
 * Calculates input and output data for transformation debugging.
 *
 * Input: Output of all transformations before the current one (with filter applied)
 * Output: Output after applying the current transformation
 *
 * "Before the current one" includes the plugin's own transformations: replaying only
 * `transformations` would show frames the debugged transformation never receives.
 *
 * @returns Empty arrays if not active or transformation not found
 */
export function useTransformationDebugData({
  selectedTransformation,
  transformations,
  systemTransformations,
  data,
  isActive,
}: UseTransformationDebugDataOptions): TransformationDebugData {
  const isDebuggable =
    isActive &&
    selectedTransformation !== null &&
    data.length > 0 &&
    transformations.some(({ transformId }) => transformId === selectedTransformation.transformId);

  const inputConfigs = useMemo(
    () =>
      selectedTransformation && isDebuggable
        ? precedingTransformations(selectedTransformation, transformations, systemTransformations)
        : NO_CONFIGS,
    [isDebuggable, selectedTransformation, transformations, systemTransformations]
  );

  // Appended to the preceding stage rather than piped into a second `transformDataFrame`:
  // `transformDataFrame` concatenates its configs into one operator chain, so both forms run the
  // same pipeline, and this one does not rebuild the preceding stage to get there.
  const outputConfigs = useMemo(
    () =>
      selectedTransformation && isDebuggable ? [...inputConfigs, selectedTransformation.transformConfig] : NO_CONFIGS,
    [isDebuggable, selectedTransformation, inputConfigs]
  );

  const inputFrames = useTransformedFrames(inputConfigs, data);
  const outputFrames = useTransformedFrames(outputConfigs, data);

  return useMemo(() => {
    if (!isDebuggable) {
      return NO_DEBUG_DATA;
    }

    // The debugged transformation only sees the frames its own filter admits.
    const filter = selectedTransformation?.transformConfig.filter;
    const matcher = filter?.options ? getFrameMatchers(filter) : undefined;

    return {
      input: matcher ? inputFrames.filter((frame) => matcher(frame)) : inputFrames,
      output: outputFrames,
    };
  }, [isDebuggable, selectedTransformation, inputFrames, outputFrames]);
}
