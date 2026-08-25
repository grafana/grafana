import { useMemo } from 'react';

import { type DataFrame, getFrameMatchers } from '@grafana/data';

import { type Transformation } from '../types';

import {
  NO_CONFIGS,
  precedingTransformations,
  type TransformationConfigs,
  useFrameReplay,
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
 * Replays the pipeline around the selected transformation for the debug view: input is everything
 * before it (filtered), output is after it runs. Counts the plugin's own transformations as
 * preceding, same as {@link precedingTransformations} — omitting them would replay input the
 * transformation never actually received.
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
    () => (debugTarget ? precedingTransformations(debugTarget, transformations, systemTransformations) : NO_CONFIGS),
    [debugTarget, transformations, systemTransformations]
  );

  const selfConfigs = useMemo(() => (debugTarget ? [debugTarget.transformConfig] : NO_CONFIGS), [debugTarget]);

  // Piped through the preceding stage's own output rather than replayed from `data` alongside it.
  // Two replays from `data` would run every preceding transformation a second time, and would leave
  // the two panes free to settle on different generations.
  //
  // The output stage pipes off what that stage *settled* on, never the untransformed frames it shows
  // while its own replay is in flight: running the debugged transformation over those would put a
  // shape in the output pane that the pipeline never produces. Until there is settled input to run
  // over, the output pane has nothing to show, which is the honest answer rather than a wrong one.
  const { frames: inputFrames, settled: settledInput } = useFrameReplay(inputConfigs, data);
  const outputFrames = useTransformedFrames(selfConfigs, settledInput);

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
