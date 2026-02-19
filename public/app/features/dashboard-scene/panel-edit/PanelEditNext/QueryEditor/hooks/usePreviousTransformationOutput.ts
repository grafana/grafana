import { useEffect, useState } from 'react';
import { mergeMap } from 'rxjs';

import { DataFrame, DataTransformContext, transformDataFrame } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { Transformation } from '../types';

interface UsePreviousTransformationOutputOptions {
  selectedTransformation: Transformation | null;
  transformations: Transformation[];
  queryData: DataFrame[];
  queryTargets?: Array<{ refId: string }>;
}

/**
 * Merges data frames with empty frames for any requested refIds that didn't return results.
 * This ensures that all query targets are represented in the output, even if they returned no data.
 */
function mergeWithEmptyFrames(frames: DataFrame[], queryTargets?: Array<{ refId: string }>): DataFrame[] {
  const mergedResult = [...frames];
  queryTargets?.forEach((target) => {
    const refIdInResult = mergedResult.some((frame) => frame.refId === target.refId);
    if (!refIdInResult) {
      mergedResult.push({ refId: target.refId, fields: [], length: 0 });
    }
  });
  return mergedResult;
}
/**
 * Calculates the output of the previous transformation in the pipeline.
 * Used by the filter display to show which data frames are available for filtering.
 *
 * @returns Output of the previous transformation, or raw query data if this is the first transformation.
 * Includes empty frames for refIds that were requested but didn't return results.
 */
export function usePreviousTransformationOutput({
  selectedTransformation,
  transformations,
  queryData,
  queryTargets,
}: UsePreviousTransformationOutputOptions): DataFrame[] {
  const [prevOutput, setPrevOutput] = useState<DataFrame[]>([]);

  useEffect(() => {
    if (!selectedTransformation || !queryData.length) {
      setPrevOutput([]);
      return;
    }

    const currentIndex = transformations.findIndex((t) => t.transformId === selectedTransformation.transformId);
    if (currentIndex === -1) {
      setPrevOutput([]);
      return;
    }

    const prevTransformIndex = currentIndex - 1;

    if (prevTransformIndex < 0) {
      // This is the first transformation, use raw query data
      setPrevOutput(mergeWithEmptyFrames(queryData, queryTargets));
      return;
    }

    // Get all transformations before this one
    const prevInputTransforms = transformations.slice(0, prevTransformIndex).map((t) => t.transformConfig);
    const prevOutputTransforms = transformations.slice(prevTransformIndex, currentIndex).map((t) => t.transformConfig);

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    const subscription = transformDataFrame(prevInputTransforms, queryData, ctx)
      .pipe(mergeMap((before) => transformDataFrame(prevOutputTransforms, before, ctx)))
      .subscribe((result) => {
        setPrevOutput(mergeWithEmptyFrames(result, queryTargets));
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedTransformation, transformations, queryData, queryTargets]);

  return prevOutput;
}
