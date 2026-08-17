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

interface UseTransformationInputDataOptions {
  selectedTransformation: Transformation | null;
  allTransformations: Transformation[];
  systemTransformations: Array<DataTransformerConfig | CustomTransformOperator>;
  rawData: DataFrame[];
}

/**
 * Returns the input data for the selected transformation — the output of everything before it
 * in the pipeline. The first transformation gets the query data with the panel plugin's own
 * transformations applied, since those run ahead of every user transformation.
 *
 * Without this, editors always see raw query data regardless of where they sit in the pipeline.
 * That causes false errors like "Organize fields only works with a single frame" even when
 * a Join earlier in the pipeline has already merged the frames.
 *
 * @param selectedTransformation - The transformation currently open in the editor.
 * @param allTransformations - The full ordered list of user transformations in the pipeline.
 * @param systemTransformations - Plugin-registered transformations, which run before all of those.
 * @param rawData - Raw data frames from the query runner, before any transformations.
 * @returns Data frames that feed into the selected transformation.
 */
export function useTransformationInputData({
  selectedTransformation,
  allTransformations,
  systemTransformations,
  rawData,
}: UseTransformationInputDataOptions): DataFrame[] {
  const [inputData, setInputData] = useState<DataFrame[]>(rawData);

  useEffect(() => {
    // TransformationEditorRenderer won't render without a selected transformation, but
    // the hook accepts null so we guard here too and fall back to rawData.
    if (!selectedTransformation) {
      setInputData(rawData);
      return;
    }

    // Where in the pipeline is this transformation? Everything before it needs to run first.
    const selectedIndex = allTransformations.findIndex(
      ({ transformId }) => transformId === selectedTransformation.transformId
    );

    // Collect the config for everything that runs before the selected one: the plugin's
    // transformations, then the user's up to this point. A transformation not in the list is treated
    // as first, so nothing user-configured precedes it.
    const precedingUserCount = Math.max(selectedIndex, 0);
    const precedingConfigs = [
      ...systemTransformations,
      ...allTransformations.slice(0, precedingUserCount).map(({ transformConfig }) => transformConfig),
    ];

    // Genuinely first in the pipeline — raw query data is the input, so there is nothing to run.
    if (precedingConfigs.length === 0) {
      setInputData(rawData);
      return;
    }
    // Provide template variable interpolation so transformers can resolve $variables in their options.
    const ctx: DataTransformContext = { interpolate: (v: string) => getTemplateSrv().replace(v) };

    // Run the pipeline up to (but not including) the selected transformation and update state when it emits.
    const subscription = transformDataFrame(precedingConfigs, rawData, ctx).subscribe(setInputData);

    return () => subscription.unsubscribe();
  }, [selectedTransformation, allTransformations, systemTransformations, rawData]);

  return inputData;
}
