import { useEffect, useState } from 'react';

import { DataFrame, DataTransformContext, transformDataFrame } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { Transformation } from '../types';

interface UseTransformationInputDataOptions {
  selectedTransformation: Transformation | null;
  allTransformations: Transformation[];
  rawData: DataFrame[];
}

/**
 * Returns the input data for the selected transformation — the output of everything before it
 * in the pipeline. The first transformation gets raw query data.
 *
 * Without this, editors always see raw query data regardless of where they sit in the pipeline.
 * That causes false errors like "Organize fields only works with a single frame" even when
 * a Join earlier in the pipeline has already merged the frames.
 *
 * @param selectedTransformation - The transformation currently open in the editor.
 * @param allTransformations - The full ordered list of transformations in the pipeline.
 * @param rawData - Raw data frames from the query runner, before any transformations.
 * @returns Data frames that feed into the selected transformation.
 */
export function useTransformationInputData({
  selectedTransformation,
  allTransformations,
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

    // First in the pipeline (or not found) — raw query data is the input.
    if (selectedIndex <= 0) {
      setInputData(rawData);
      return;
    }

    // Collect the DataTransformerConfig for every transformation that runs before the selected one.
    const precedingConfigs = allTransformations.slice(0, selectedIndex).map(({ transformConfig }) => transformConfig);
    // Provide template variable interpolation so transformers can resolve $variables in their options.
    const ctx: DataTransformContext = { interpolate: (v: string) => getTemplateSrv().replace(v) };

    // Run the pipeline up to (but not including) the selected transformation and update state when it emits.
    const subscription = transformDataFrame(precedingConfigs, rawData, ctx).subscribe(setInputData);

    return () => subscription.unsubscribe();
  }, [selectedTransformation, allTransformations, rawData]);

  return inputData;
}
