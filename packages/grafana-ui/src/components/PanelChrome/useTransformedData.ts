import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import {
  compareArrayValues,
  compareDataFrameStructures,
  type DataFrame,
  type DataQueryError,
  LoadingState,
  type PanelData,
  transformPanelData,
} from '@grafana/data';
import { type DataTransformerConfig } from '@grafana/schema';

import { usePanelContext } from './PanelContext';
import { useAdHocTransformations } from './useAdHocTransformations';

/**
 * @alpha -- experimental
 */
export interface UseTransformedDataOptions {
  /**
   * The pipeline to apply. Defaults to the panel's own, read through `useAdHocTransformations`.
   *
   * Pass it explicitly when the panel also calls `useAdHocTransformations` itself: in hosts that
   * provide no pipeline that hook keeps one in component state, and two instances of it would each
   * hold their own, so the one this hook applies would not be the one the panel wrote to.
   */
  transformations?: DataTransformerConfig[];

  /**
   * Treat the last `splitTrailing` transformations as a separate output stage and also return
   * `dataBeforeTrailing`, the data as it was before them.
   *
   * A panel whose last transformation selects and orders columns needs this: the transformed data
   * only contains the columns it kept, so a column picker built from it could never offer the rest
   * back. Both stages come out of a single pass over the pipeline.
   */
  splitTrailing?: number;

  /**
   * Overrides how field config is applied to the transformed frames. Needed by panels with their
   * own field config registry or synthesized defaults, and it is the only way to get field config
   * applied at all in hosts that provide no `PanelContext.applyFieldConfig` (Explore, a bare
   * `PanelRenderer`). Must be memoized, and must be safe to call more than once per render.
   */
  applyFieldConfig?: (data: PanelData) => PanelData;
}

/**
 * @alpha -- experimental
 */
export interface TransformedPanelData {
  /**
   * Transformed data with field config applied. Identical to the input when there are no
   * transformations to run, so it is safe to use unconditionally.
   */
  data: PanelData;

  /**
   * Output of the pipeline up to, but excluding, the last `splitTrailing` transformations, with
   * field config applied. Only set when `splitTrailing` was requested and a run has completed.
   */
  dataBeforeTrailing?: PanelData;

  /** True while a transformation run is in flight. The previous result is kept meanwhile. */
  isTransforming: boolean;

  /**
   * Set when the pipeline threw. `data.state` is `Error` and `data.errors` carries this too, but
   * PanelChrome's header cannot see it, so a panel should surface it (e.g. PanelDataErrorView).
   */
  error?: DataQueryError;
}

interface TransformResult {
  series: DataFrame[];
  annotations?: DataFrame[];
  beforeTrailing?: { series: DataFrame[]; annotations?: DataFrame[] };
}

/**
 * Mirrors the message SceneDataTransformer produces for a failing pipeline. `toDataQueryError`
 * lives in @grafana/runtime, which @grafana/ui cannot depend on, so the shape is built here.
 */
function toTransformationError(err: unknown): DataQueryError {
  let message = 'Unknown error';

  if (typeof err === 'string') {
    message = err;
  } else if (err instanceof Error) {
    message = err.message;
  } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    message = err.message;
  }

  return { message: `Error transforming data: ${message}` };
}

/**
 * Runs the pipeline in one pass, capturing the intermediate result when the caller asked for the
 * trailing transformations to be split off.
 */
function runPipeline(
  transformations: DataTransformerConfig[],
  source: PanelData,
  splitTrailing: number
): Observable<TransformResult> {
  if (splitTrailing <= 0) {
    return transformPanelData(transformations, source).pipe(
      map(({ series, annotations }) => ({ series, annotations }))
    );
  }

  const splitAt = Math.max(0, transformations.length - splitTrailing);
  const head = transformations.slice(0, splitAt);
  const tail = transformations.slice(splitAt);

  return transformPanelData(head, source).pipe(
    switchMap((intermediate) =>
      // The tail runs on the pre-field-config intermediate, so each stage gets field config applied
      // exactly once from unprocessed frames — the same contract as the pipeline as a whole.
      transformPanelData(tail, intermediate).pipe(
        map((final) => ({
          series: final.series,
          annotations: final.annotations,
          beforeTrailing: { series: intermediate.series, annotations: intermediate.annotations },
        }))
      )
    )
  );
}

/**
 * Applies the panel's own transformation pipeline, for panels that declare `adHocTransforms: true`
 * in their plugin.json and therefore receive untransformed data in a dashboard.
 *
 * Returns `input` unchanged when there is nothing to run, so a panel can adopt this with a single
 * line. In hosts that hand over no pipeline (Explore, a bare `PanelRenderer`) the transformations
 * the panel added through `useAdHocTransformations` are still applied, they just are not persisted.
 *
 * Field config is applied *after* the transformations, which is what the normal pipeline does and
 * what makes transformations that rename or create fields render correctly. Note this means the
 * returned data went through field config exactly once, from pre-field-config source data — do not
 * mix frames from `props.data` with frames from here.
 *
 * @alpha -- experimental
 */
export function useTransformedData(input: PanelData, options: UseTransformedDataOptions = {}): TransformedPanelData {
  const {
    splitTrailing = 0,
    applyFieldConfig: applyFieldConfigOverride,
    transformations: transformationsProp,
  } = options;
  const { getUntransformedData, applyFieldConfig: hostApplyFieldConfig } = usePanelContext();
  const { enabled, transformations: ownTransformations } = useAdHocTransformations();

  const transformations = transformationsProp ?? ownTransformations;

  const active = transformations.length > 0;
  // Only the host's own pipeline is bypassed upstream. When the panel is holding the pipeline in
  // component state the host already applied field config to `input`, so that is the source.
  const source = (enabled && active && getUntransformedData?.()) || input;

  const applyFieldConfig = applyFieldConfigOverride ?? hostApplyFieldConfig;

  const [result, setResult] = useState<TransformResult | undefined>(undefined);
  const [error, setError] = useState<DataQueryError | undefined>(undefined);
  const [isTransforming, setIsTransforming] = useState(false);

  const structureRev = useRef(0);
  const prevSeries = useRef<DataFrame[]>([]);

  useEffect(() => {
    if (!active) {
      setResult(undefined);
      setError(undefined);
      setIsTransforming(false);
      return;
    }

    setIsTransforming(true);

    // Deliberately keyed on the frames rather than on `source` identity: a metadata-only change
    // (loading state, request, errors) must not re-run the pipeline. Same trick as
    // SceneDataTransformer's own memoization.
    const subscription = runPipeline(transformations, source, splitTrailing).subscribe({
      next: (transformed) => {
        setResult(transformed);
        setError(undefined);
        setIsTransforming(false);
      },
      error: (err) => {
        setError(toTransformationError(err));
        setIsTransforming(false);
      },
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, transformations, splitTrailing, source.series, source.annotations]);

  const withFieldConfig = useCallback(
    (series: DataFrame[], annotations: DataFrame[] | undefined): PanelData => {
      const next: PanelData = { ...source, series, annotations };

      return applyFieldConfig ? applyFieldConfig(next) : next;
    },
    // `source` is excluded on purpose — only the frames the caller passes matter here, and
    // including it would re-apply field config on every metadata change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyFieldConfig]
  );

  // Field config is the expensive part, so it only re-runs when the frames themselves change.
  const processed = useMemo(() => {
    if (!result) {
      return undefined;
    }

    if (!compareArrayValues(result.series, prevSeries.current, compareDataFrameStructures)) {
      structureRev.current++;
      prevSeries.current = result.series;
    }

    return {
      data: withFieldConfig(result.series, result.annotations),
      beforeTrailing: result.beforeTrailing
        ? withFieldConfig(result.beforeTrailing.series, result.beforeTrailing.annotations)
        : undefined,
      // Captured here rather than read where it is used, so it cannot be picked up by a memo that
      // has not re-run since the last structural change.
      structureRev: structureRev.current,
    };
  }, [result, withFieldConfig]);

  const metadata = useMemo(
    () => ({
      // Metadata always comes from the current source, so a refresh is reflected immediately even
      // while the previous transformed frames are still on screen.
      state: error ? LoadingState.Error : source.state,
      request: source.request,
      timeRange: source.timeRange,
      errors: error ? [...(source.errors ?? []), error] : source.errors,
    }),
    [error, source]
  );

  const data = useMemo(() => {
    if (!active) {
      return input;
    }

    if (!processed) {
      // First run: hold back the untransformed frames rather than flashing them for a tick.
      return isTransforming ? { ...input, state: LoadingState.Loading } : input;
    }

    return { ...processed.data, ...metadata, structureRev: processed.structureRev };
  }, [active, input, processed, isTransforming, metadata]);

  const dataBeforeTrailing = useMemo(
    () =>
      processed?.beforeTrailing
        ? { ...processed.beforeTrailing, ...metadata, structureRev: processed.structureRev }
        : undefined,
    [processed, metadata]
  );

  return { data, dataBeforeTrailing, isTransforming, error };
}
