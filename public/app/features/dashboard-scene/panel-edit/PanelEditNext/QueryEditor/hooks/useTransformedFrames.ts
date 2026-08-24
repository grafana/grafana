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

export type TransformationConfigs = Array<DataTransformerConfig | CustomTransformOperator>;

/** Stable identity for "nothing to run", so passing it does not re-run a caller's memo or effect. */
export const NO_CONFIGS: TransformationConfigs = [];

/**
 * The context every editor replay runs with. One definition, so a change to how transformation
 * options resolve variables reaches all of them rather than whichever the author remembered.
 */
function getTransformationContext(): DataTransformContext {
  return { interpolate: (v: string) => getTemplateSrv().replace(v) };
}

/**
 * Runs `configs` over `frames` and returns what comes out.
 *
 * The panel's pipeline does not publish its intermediate stages, so the editors rebuild the ones they
 * need to answer "what does this transformation receive", "what did it produce", and "which frames
 * can this filter pick from". Each of those is this same replay — subscribe, hold what it emits, let
 * go on the way out — and having one copy is what stops them disagreeing about variable
 * interpolation or about when a subscription is dropped.
 *
 * `configs` has to be referentially stable across renders, so callers build it in a `useMemo`. A
 * fresh array each render re-runs the effect, which sets state, which renders again.
 *
 * Empty `configs` returns `frames` itself — same reference, no subscription — which is both the fast
 * path and what lets "nothing precedes this transformation" be answered without a render. Otherwise
 * the previous output is held until the pipeline emits, because `transformDataFrame` resolves
 * asynchronously for every standard transformation.
 */
export function useTransformedFrames(configs: TransformationConfigs, frames: DataFrame[]): DataFrame[] {
  const [transformed, setTransformed] = useState(frames);

  useEffect(() => {
    if (configs.length === 0) {
      return;
    }

    const subscription = transformDataFrame(configs, frames, getTransformationContext()).subscribe(setTransformed);

    return () => subscription.unsubscribe();
  }, [configs, frames]);

  return configs.length === 0 ? frames : transformed;
}

/**
 * What the pipeline runs ahead of `selected`: the panel plugin's transformations, which precede every
 * user transformation, then the user's own up to it.
 *
 * A `selected` the list does not contain is treated as first rather than sliced by its `-1` index,
 * which would silently drop the list's last entry.
 */
export function precedingTransformations(
  selected: Transformation,
  all: Transformation[],
  system: TransformationConfigs
): TransformationConfigs {
  const selectedIndex = all.findIndex(({ transformId }) => transformId === selected.transformId);

  return [...system, ...all.slice(0, Math.max(selectedIndex, 0)).map(({ transformConfig }) => transformConfig)];
}
