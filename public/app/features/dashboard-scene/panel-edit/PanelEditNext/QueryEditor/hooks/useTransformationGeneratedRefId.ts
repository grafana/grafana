import { useMemo } from 'react';

import { type DataFrame, type DataTransformerConfig } from '@grafana/data';

import { type Transformation } from '../types';

import {
  NO_CONFIGS,
  frameMatcherFor,
  isInterpolatable,
  precedingTransformations,
  useFrameReplay,
  useInterpolatedConfigs,
} from './useTransformedFrames';

interface UseTransformationGeneratedRefIdOptions {
  transformation: Transformation | null;
  transformations: Transformation[];
  rawData: DataFrame[];
}

/**
 * The refId the transformation's output frame gets when the user has not pinned one.
 *
 * Derived from what the transformation actually emits rather than guessed from its input, because
 * the two diverge: Reduce in fields mode keeps the incoming refIds, transformers that drop empty
 * frames build the name from fewer of them, and the no-op paths return their input untouched.
 *
 * Undefined when there is no single frame to name — nothing has resolved yet, or the transformation
 * emitted several frames, none of which is "the" output.
 */
export function useTransformationGeneratedRefId({
  transformation,
  transformations,
  rawData,
}: UseTransformationGeneratedRefIdOptions): string | undefined {
  const precedingConfigs = useMemo(
    () => (transformation ? precedingTransformations(transformation, transformations) : NO_CONFIGS),
    [transformation, transformations]
  );

  const preceding = useFrameReplay(precedingConfigs, rawData);

  // Interpolated here rather than left to the replay, because the filter below is applied outside
  // it: a `$var` in the filter has to resolve before it can pick the same frames the panel's
  // pipeline does.
  const interpolatedConfigs = useInterpolatedConfigs(
    useMemo(() => (transformation ? [transformation.transformConfig] : NO_CONFIGS), [transformation])
  );

  // Without the pinned refId, so what comes back is the name the user would get by clearing the
  // field; without `disabled`, so a disabled transformation still shows one; and without the frame
  // filter, which `transformDataFrame` honours by splicing the unmatched frames back into the
  // output, leaving no single frame to read a name off. The filter is applied to the input instead,
  // which is the same thing minus the splice.
  const previewConfigs = useMemo(() => {
    const [config] = interpolatedConfigs;
    if (config === undefined || !isInterpolatable(config)) {
      return NO_CONFIGS;
    }
    const preview: DataTransformerConfig = { ...config, refId: undefined, disabled: undefined, filter: undefined };
    return [preview];
  }, [interpolatedConfigs]);

  // A fresh array each render is fine: the replay holds its input stable by element.
  const matcher = frameMatcherFor(interpolatedConfigs[0]);
  const admitted = matcher ? preceding.settled.filter((frame) => matcher(frame)) : preceding.settled;

  // `settled` rather than `frames`: a name read off the stand-in output of a pipeline still in
  // flight is a name the panel never produced.
  const { settled } = useFrameReplay(previewConfigs, admitted);

  // An empty preview pipeline replays its input, which is this transformation's input rather than
  // anything it produced.
  if (previewConfigs === NO_CONFIGS) {
    return undefined;
  }

  return settled.length === 1 ? settled[0].refId : undefined;
}
