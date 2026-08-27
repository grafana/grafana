import { useMemo } from 'react';

import { type DataFrame, type DataTransformerConfig, type FrameMatcher, getFrameMatchers } from '@grafana/data';

import { type Transformation } from '../types';

import { NO_CONFIGS, isInterpolatable, precedingTransformations, useFrameReplay } from './useTransformedFrames';

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
 * The matcher for the filter as the replay ran it, or nothing if that filter cannot be built into
 * one.
 *
 * `getFrameMatchers` throws on a matcher id it does not know, and `byName` runs its option through
 * `stringToJsRegex`, which throws on a `/`-prefixed string that is not a complete `/pattern/flags` —
 * a variable resolving to a path is enough. The pipeline's own call sits behind the replay's error
 * handling; this one runs during render, where a throw would take the drawer down with it, so a
 * filter that cannot be built shows the input unnarrowed instead.
 */
function frameMatcherFor(config: DataTransformerConfig | undefined): FrameMatcher | undefined {
  if (!config?.filter?.options) {
    return undefined;
  }

  try {
    return getFrameMatchers(config.filter);
  } catch (err) {
    console.error('Failed to build a transformation filter for the panel editor', err);
    return undefined;
  }
}

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
  //
  // The output stage pipes off what that stage *settled* on, never the untransformed frames it shows
  // while its own replay is in flight: running the debugged transformation over those would put a
  // shape in the output pane that the pipeline never produces. Until there is settled input to run
  // over, the output pane has nothing to show, which is the honest answer rather than a wrong one.
  const { frames: inputFrames, settled: settledInput } = useFrameReplay(inputConfigs, data);
  const { frames: outputFrames, configs: ranConfigs } = useFrameReplay(selfConfigs, settledInput);

  return useMemo(() => {
    if (!debugTarget) {
      return NO_DEBUG_DATA;
    }

    // The debugged transformation only sees the frames its own filter admits. `transformDataFrame`
    // applies that filter itself, so only the displayed input is narrowed here — and by the filter
    // the replay ran, not the one the config holds: a `$var` in it resolves before either sees it.
    const [ranConfig] = ranConfigs;
    const matcher = frameMatcherFor(isInterpolatable(ranConfig) ? ranConfig : undefined);

    return {
      input: matcher ? inputFrames.filter((frame) => matcher(frame)) : inputFrames,
      output: outputFrames,
    };
  }, [debugTarget, inputFrames, outputFrames, ranConfigs]);
}
