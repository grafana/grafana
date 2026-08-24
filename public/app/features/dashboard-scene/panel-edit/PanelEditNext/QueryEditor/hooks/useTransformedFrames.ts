import { useEffect, useState } from 'react';
import { type Subscription } from 'rxjs';

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
 * `configs` and `frames` have to be referentially stable across renders, so callers build `configs`
 * in a `useMemo`. A fresh array each render is a fresh generation each render: the effect re-runs,
 * sets state, and renders again, without end.
 *
 * Empty `configs` returns `frames` itself — same reference, no subscription — which is both the fast
 * path and what lets "nothing precedes this transformation" be answered without a render.
 *
 * What comes back is always derived from the `configs` and `frames` passed on this render, never
 * from an earlier pair. `transformDataFrame` resolves asynchronously for every standard
 * transformation, so there is a render between a new query landing and its output arriving; holding
 * the previous output across it would hand a caller frames from the last query to pair with this
 * query's metadata, and editors configure their rows from that pairing. The input frames are
 * returned instead — untransformed, but from the generation the caller is asking about. Failing to
 * transform at all resolves the same way, so a broken transformation cannot pin an editor to frames
 * from some earlier query with nothing to say why.
 */
export function useTransformedFrames(configs: TransformationConfigs, frames: DataFrame[]): DataFrame[] {
  const [transformed, setTransformed] = useState<TransformedFrames | undefined>(undefined);

  useEffect(() => {
    if (configs.length === 0) {
      return;
    }

    let subscription: Subscription | undefined;

    try {
      subscription = transformDataFrame(configs, frames, getTransformationContext()).subscribe({
        next: (result) => setTransformed({ configs, frames, result }),
        error: (err) => logTransformationFailure(err),
      });
    } catch (err) {
      // `transformDataFrame` builds its operator chain synchronously, so a custom operator whose
      // factory throws throws from here — outside the observable, and out of this effect into the
      // nearest error boundary if it is not caught.
      logTransformationFailure(err);
    }

    return () => subscription?.unsubscribe();
  }, [configs, frames]);

  if (configs.length === 0) {
    return frames;
  }

  const isCurrent = transformed?.configs === configs && transformed?.frames === frames;

  return isCurrent ? transformed.result : frames;
}

interface TransformedFrames {
  configs: TransformationConfigs;
  frames: DataFrame[];
  result: DataFrame[];
}

function logTransformationFailure(err: unknown) {
  // The panel itself surfaces this as panel data error, because the pipeline wraps the same call in
  // `catchError`. The editors have nowhere to render it, so it is logged rather than dropped.
  console.error('Failed to replay transformations for the panel editor', err);
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
