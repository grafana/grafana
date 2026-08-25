import { useEffect, useRef, useState } from 'react';
import { type Subscription } from 'rxjs';

import {
  compareArrayValues,
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformContext,
  type DataTransformerConfig,
  transformDataFrame,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataTopic } from '@grafana/schema';

import { type Transformation } from '../types';

export type TransformationConfigs = Array<DataTransformerConfig | CustomTransformOperator>;

/** Stable identity for "nothing to run", so passing it does not re-run a caller's memo or effect. */
export const NO_CONFIGS: TransformationConfigs = [];

/**
 * The context every editor replay runs with. One definition, so a change to how transformation
 * options resolve variables reaches all of them rather than whichever the author remembered.
 *
 * This is only consulted by transformers that interpolate their own options, such as `formatTime`.
 * `transformDataFrame` skips its own pass over the options whenever a scene is active, which in the
 * panel editor is always — see {@link interpolateConfigs} for the half that covers.
 */
function getTransformationContext(): DataTransformContext {
  return { interpolate: (v: string) => getTemplateSrv().replace(v) };
}

/**
 * Resolves variables in transformation options the way the panel's pipeline does before it runs
 * them, because `transformDataFrame` will not: it skips interpolation while a scene is active, and
 * `SceneDataTransformer` compensates by interpolating the configs first. Replaying without this
 * hands the editor a transformation matching on the literal `$var` the panel never ran.
 *
 * Custom operators are skipped, matching the pipeline: their options are captured in a closure, so
 * there is nothing here to resolve.
 */
function interpolateConfigs(configs: TransformationConfigs): TransformationConfigs {
  return configs.map((config) => {
    if (typeof config !== 'object' || 'operator' in config) {
      return config;
    }

    try {
      return JSON.parse(getTemplateSrv().replace(JSON.stringify(config)));
    } catch {
      // A variable value can carry characters that do not survive the round trip. The pipeline has
      // the same exposure; running the config uninterpolated beats dropping the transformation.
      return config;
    }
  });
}

/**
 * Returns the previous array whenever `value` holds the same elements in the same order.
 *
 * Callers rebuild these arrays every time the panel emits — `useTransformations` memoizes on
 * transformer state, which carries `data` — while the elements themselves are the stable objects
 * held in Scene state. Comparing identity alone would resubscribe on every emission, and an array
 * built fresh each render would resubscribe without end.
 */
function useStableArray<T>(value: T[]): T[] {
  const stable = useRef(value);

  // Safe during render: a repeated render derives the same reference.
  if (!compareArrayValues(stable.current, value, Object.is)) {
    stable.current = value;
  }

  return stable.current;
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
 * Empty `configs` returns `frames` itself — same reference, no subscription — which is both the fast
 * path and what lets "nothing precedes this transformation" be answered without a render.
 *
 * `transformDataFrame` resolves asynchronously for every standard transformation, so a new query
 * always lands a render before its output does. What this pipeline last produced stands in over that
 * gap: it is stale by one query, but it is the shape the editors are built to read. The
 * untransformed frames are not — they are the pre-pipeline shape, and an editor reading them reports
 * on a frame the panel never had.
 *
 * A change to `configs` is a different pipeline, so nothing is held across it.
 *
 * A replay that fails settles on the untransformed frames and records that it did, rather than
 * leaving every later render looking like one that is still waiting.
 */
export function useTransformedFrames(configs: TransformationConfigs, frames: DataFrame[]): DataFrame[] {
  const stableConfigs = useStableArray(configs);
  const stableFrames = useStableArray(frames);
  const [transformed, setTransformed] = useState<TransformedFrames | undefined>(undefined);

  useEffect(() => {
    if (stableConfigs.length === 0) {
      return;
    }

    let subscription: Subscription | undefined;
    const settle = (result: DataFrame[]) => setTransformed({ configs: stableConfigs, result });
    const fail = (err: unknown) => {
      logTransformationFailure(err);
      settle(stableFrames);
    };

    try {
      subscription = transformDataFrame(
        interpolateConfigs(stableConfigs),
        stableFrames,
        getTransformationContext()
      ).subscribe({
        next: settle,
        error: fail,
      });
    } catch (err) {
      // `transformDataFrame` builds its operator chain synchronously, so a custom operator whose
      // factory throws throws from here — outside the observable, and out of this effect into the
      // nearest error boundary if it is not caught.
      fail(err);
    }

    return () => subscription?.unsubscribe();
  }, [stableConfigs, stableFrames]);

  if (stableConfigs.length === 0) {
    return stableFrames;
  }

  // Held across a data change, dropped across a pipeline change. `transformDataFrame` resolves a
  // render later than the frames it belongs to, so every query leaves a render with no output yet.
  // Falling back to the untransformed frames there shows a shape the pipeline never produces — an
  // Organize editor reads them and flips to "only works with a single frame" on every refresh. What
  // the same pipeline last produced is the right shape, so it stands in until the new one lands.
  // Output from a *different* pipeline is not held: that shape is genuinely gone.
  const isThisPipeline = transformed?.configs === stableConfigs;

  return isThisPipeline ? transformed.result : stableFrames;
}

interface TransformedFrames {
  configs: TransformationConfigs;
  result: DataFrame[];
}

function logTransformationFailure(err: unknown) {
  // The panel itself surfaces this as panel data error, because the pipeline wraps the same call in
  // `catchError`. The editors have nowhere to render it, so it is logged rather than dropped.
  console.error('Failed to replay transformations for the panel editor', err);
}

/**
 * What the pipeline runs ahead of `selected`: the user's transformations up to it.
 *
 * Annotation-topic entries are left out, because the pipeline routes those to `data.annotations` in
 * a separate pass — replaying them over the series would apply a transformation to frames it never
 * receives.
 *
 * A `selected` the list does not contain is treated as first rather than sliced by its `-1` index,
 * which would silently drop the list's last entry.
 */
export function precedingTransformations(selected: Transformation, all: Transformation[]): TransformationConfigs {
  const selectedIndex = all.findIndex(({ transformId }) => transformId === selected.transformId);

  const preceding = all
    .slice(0, Math.max(selectedIndex, 0))
    .map(({ transformConfig }) => transformConfig)
    .filter((config) => config.topic == null || config.topic === DataTopic.Series);

  return preceding.length === 0 ? NO_CONFIGS : preceding;
}
