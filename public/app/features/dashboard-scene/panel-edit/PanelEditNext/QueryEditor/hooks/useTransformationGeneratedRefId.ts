import { useMemo } from 'react';

import { type DataFrame, type DataTransformerConfig, getFrameMatchers } from '@grafana/data';

import { type Transformation } from '../types';

import { NO_CONFIGS, precedingTransformations, useFrameReplay } from './useTransformedFrames';

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

  // Without the pinned refId, so what comes back is the name the user would get by clearing the
  // field; without `disabled`, so a disabled transformation still shows one; and without the frame
  // filter, which `transformDataFrame` would honour by splicing the unmatched frames back into the
  // output, leaving no single frame to read a name off. The filter is applied to the input instead.
  const previewConfigs = useMemo(() => {
    if (!transformation) {
      return NO_CONFIGS;
    }
    const preview: DataTransformerConfig = {
      ...transformation.transformConfig,
      refId: undefined,
      disabled: undefined,
      filter: undefined,
    };
    return [preview];
  }, [transformation]);

  const filter = transformation?.transformConfig.filter;
  const filtered = useMemo(() => {
    if (!filter?.options) {
      return preceding.settled;
    }
    const matcher = getFrameMatchers(filter);
    return preceding.settled.filter((frame) => matcher(frame));
  }, [filter, preceding.settled]);

  // `settled` rather than `frames`: a name read off the stand-in output of a pipeline still in
  // flight is a name the panel never produced.
  const { settled } = useFrameReplay(previewConfigs, filtered);

  // An empty preview pipeline replays its input, which is this transformation's input rather than
  // anything it produced.
  if (!transformation) {
    return undefined;
  }

  return settled.length === 1 ? settled[0].refId : undefined;
}
