import { useEffect, useState } from 'react';
import { mergeMap } from 'rxjs';

import { DataFrame, DataTransformContext, getFrameMatchers, transformDataFrame } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { Transformation } from '../types';

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

/**
 * Calculates input and output data for transformation debugging.
 *
 * Input: Output of all transformations before the current one (with filter applied)
 * Output: Output after applying the current transformation
 *
 * @returns Empty arrays if not active or transformation not found
 */
export function useTransformationDebugData({
  selectedTransformation,
  transformations,
  data,
  isActive,
}: UseTransformationDebugDataOptions): TransformationDebugData {
  const [input, setInput] = useState<DataFrame[]>([]);
  const [output, setOutput] = useState<DataFrame[]>([]);

  useEffect(() => {
    if (!isActive || !selectedTransformation || !data.length) {
      setInput([]);
      setOutput([]);
      return;
    }

    const currentIndex = transformations.findIndex((t) => t.transformId === selectedTransformation.transformId);
    if (currentIndex === -1) {
      setInput([]);
      setOutput([]);
      return;
    }

    const config = selectedTransformation.transformConfig;
    const matcher = config.filter?.options ? getFrameMatchers(config.filter) : undefined;

    const inputTransforms = transformations.slice(0, currentIndex).map((t) => t.transformConfig);
    const outputTransforms = [config];

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    // Calculate input: apply all transformations before this one, then apply filter matcher
    const inputSubscription = transformDataFrame(inputTransforms, data, ctx).subscribe((frames) => {
      setInput(matcher ? frames.filter((frame) => matcher(frame)) : frames);
    });

    // Calculate output: apply all transformations up to and including this one
    const outputSubscription = transformDataFrame(inputTransforms, data, ctx)
      .pipe(mergeMap((before) => transformDataFrame(outputTransforms, before, ctx)))
      .subscribe(setOutput);

    return () => {
      inputSubscription.unsubscribe();
      outputSubscription.unsubscribe();
    };
  }, [isActive, selectedTransformation, transformations, data]);

  return { input, output };
}
