import { isEqual } from 'lodash';
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

/** Stable identity for "this replay has produced nothing yet", for the same reason. */
const NO_FRAMES: DataFrame[] = [];

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
 * Configs already reported as unresolvable, so resolving on every render does not repeat the report.
 * Keyed on the object Scene state holds, so an edit to the transformation reports afresh.
 */
const reportedUnresolvable = new WeakSet<DataTransformerConfig>();

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
    if (!isInterpolatable(config)) {
      return config;
    }

    try {
      return JSON.parse(getTemplateSrv().replace(JSON.stringify(config)));
    } catch (err) {
      // A variable value can carry characters that do not survive the round trip. The pipeline has
      // the same exposure; running the config uninterpolated beats dropping the transformation.
      // Reported, because the symptom is an editor quietly describing a transformation that matches
      // on the literal `$var`, which is indistinguishable from the editor simply being wrong.
      if (!reportedUnresolvable.has(config)) {
        reportedUnresolvable.add(config);
        console.error(`Failed to resolve variables in the "${config.id}" transformation for the panel editor`, err);
      }

      return config;
    }
  });
}

/**
 * A plain config object, whose options are data this can resolve — as opposed to a custom operator,
 * which holds its options in a closure.
 */
export function isInterpolatable(config: TransformationConfigs[number]): config is DataTransformerConfig {
  return typeof config === 'object' && !('operator' in config);
}

/**
 * Whether two configs resolve to the same transformation. Custom operators are compared by
 * identity, which is what "unchanged" means for something interpolation passes through untouched.
 */
function isSameConfig(a: TransformationConfigs[number], b: TransformationConfigs[number]): boolean {
  return isInterpolatable(a) && isInterpolatable(b) ? isEqual(a, b) : Object.is(a, b);
}

/**
 * The configs with their variables resolved, held stable until the values they resolve to change.
 *
 * Resolving during render rather than inside the replay's effect is what lets the replay follow a
 * variable. A variable change re-renders the editor — the panel's transformer reprocesses and pushes
 * new state, and `useTransformations` rebuilds its array around the same entries — but the config
 * objects in Scene state still hold the literal `$var`. The resolved options are the only thing that
 * moves, so they are the only thing an effect can key on.
 */
function useInterpolatedConfigs(configs: TransformationConfigs): TransformationConfigs {
  return useStableArray(interpolateConfigs(configs), isSameConfig);
}

/**
 * Returns the previous array whenever `value` holds the same elements in the same order.
 *
 * Callers rebuild these arrays every time the panel emits — `useTransformations` memoizes on
 * transformer state, which carries `data` — while the elements themselves are the stable objects
 * held in Scene state. Comparing identity alone would resubscribe on every emission, and an array
 * built fresh each render would resubscribe without end.
 */
function useStableArray<T>(value: T[], isSame: (a: T, b: T) => boolean = Object.is): T[] {
  const stable = useRef(value);

  // Safe during render: a repeated render derives the same reference.
  if (!compareArrayValues(stable.current, value, isSame)) {
    stable.current = value;
  }

  return stable.current;
}

/**
 * Runs `configs` over `frames` and returns what comes out, in the two forms a caller can need.
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
export function useFrameReplay(configs: TransformationConfigs, frames: DataFrame[]): FrameReplay {
  const stableConfigs = useStableArray(configs);
  const stableFrames = useStableArray(frames);
  const interpolatedConfigs = useInterpolatedConfigs(stableConfigs);
  const [transformed, setTransformed] = useState<TransformedFrames | undefined>(undefined);

  useEffect(() => {
    if (stableConfigs.length === 0) {
      return;
    }

    let subscription: Subscription | undefined;
    const settle = (result: DataFrame[]) => setTransformed({ configs: stableConfigs, frames: result, settled: result });
    const fail = (err: unknown) => {
      logTransformationFailure(err);
      // The untransformed frames are the closest shape there is to show, but this pipeline never
      // produced them, so nothing settled: a replay piped off a failure would run over frames the
      // panel never had. Recorded against `stableConfigs` all the same, so the failure settles.
      setTransformed({ configs: stableConfigs, frames: stableFrames, settled: NO_FRAMES });
    };

    try {
      subscription = transformDataFrame(interpolatedConfigs, stableFrames, getTransformationContext()).subscribe({
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
    // Keyed on the resolved options, so a variable change re-runs the replay, and on `stableConfigs`
    // too, so an edit that happens to resolve the same way still counts as a new pipeline.
  }, [interpolatedConfigs, stableConfigs, stableFrames]);

  if (stableConfigs.length === 0) {
    // An empty pipeline produces its input, so there is no gap for anything to stand in over.
    return { frames: stableFrames, settled: stableFrames, configs: interpolatedConfigs };
  }

  // Held across a data change, dropped across a pipeline change. `transformDataFrame` resolves a
  // render later than the frames it belongs to, so every query leaves a render with no output yet.
  // Falling back to the untransformed frames there shows a shape the pipeline never produces — an
  // Organize editor reads them and flips to "only works with a single frame" on every refresh. What
  // the same pipeline last produced is the right shape, so it stands in until the new one lands.
  // Output from a *different* pipeline is not held: that shape is genuinely gone. A variable change
  // is not one of those — the user's list of transformations is unchanged, so its last output still
  // stands in while the re-resolved replay runs.
  const isThisPipeline = transformed?.configs === stableConfigs;

  return isThisPipeline
    ? { frames: transformed.frames, settled: transformed.settled, configs: interpolatedConfigs }
    : { frames: stableFrames, settled: NO_FRAMES, configs: interpolatedConfigs };
}

/** {@link useFrameReplay} for the callers that only need something to show. */
export function useTransformedFrames(configs: TransformationConfigs, frames: DataFrame[]): DataFrame[] {
  return useFrameReplay(configs, frames).frames;
}

/**
 * What a replay gives back: two views of its frames, which part company while one is in flight, and
 * the configs it ran to get them.
 *
 * An editor reads `frames`, which stands in the closest shape there is whenever this pipeline has
 * not produced one yet — including after a replay that failed. A replay piped off this one reads
 * `settled`, which is only ever this pipeline's own output, and is empty until there is one:
 * running a further transformation over a stand-in produces a shape the panel never emits.
 *
 * `configs` are those configs with their variables resolved. Anything describing what the replay did
 * — which frames a filter admitted, say — has to read these rather than the originals, which still
 * hold the literal `$var` that never reached `transformDataFrame`.
 */
export interface FrameReplay {
  frames: DataFrame[];
  settled: DataFrame[];
  configs: TransformationConfigs;
}

/** What a replay produced, tagged with the pipeline that produced it, so a later one is not mistaken for it. */
interface TransformedFrames {
  configs: TransformationConfigs;
  frames: DataFrame[];
  settled: DataFrame[];
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
