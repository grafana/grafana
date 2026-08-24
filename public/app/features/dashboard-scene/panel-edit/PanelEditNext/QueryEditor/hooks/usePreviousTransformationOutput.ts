import { useEffect, useState } from 'react';

import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformContext,
  type DataTransformerConfig,
  transformDataFrame,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { type Transformation } from '../types';

interface UsePreviousTransformationOutputOptions {
  selectedTransformation: Transformation | null;
  transformations: Transformation[];
  systemTransformations: Array<DataTransformerConfig | CustomTransformOperator>;
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
 * The frames listed here have to be the ones the filter matcher will run against, so the panel
 * plugin's own transformations count as preceding the user's first one — they run ahead of all of
 * them, and they are what renames, splits or joins the frames the user is picking from.
 *
 * @returns Output of everything preceding the selected transformation, or the query result if
 * nothing does. Includes empty frames for refIds that were requested but didn't return results.
 */
export function usePreviousTransformationOutput({
  selectedTransformation,
  transformations,
  systemTransformations,
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

    // Everything that runs ahead of the selected transformation: the plugin's transformations first,
    // then the user's up to this one.
    const precedingConfigs = [
      ...systemTransformations,
      ...transformations.slice(0, currentIndex).map((t) => t.transformConfig),
    ];

    if (precedingConfigs.length === 0) {
      // Nothing precedes it, so it reads the query result as it came back.
      setPrevOutput(mergeWithEmptyFrames(queryData, queryTargets));
      return;
    }

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    const subscription = transformDataFrame(precedingConfigs, queryData, ctx).subscribe((result) => {
      setPrevOutput(mergeWithEmptyFrames(result, queryTargets));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedTransformation, transformations, systemTransformations, queryData, queryTargets]);

  return prevOutput;
}
