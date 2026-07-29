import { useEffect, useMemo, useRef, useState } from 'react';

import {
  compareArrayValues,
  compareDataFrameStructures,
  type DataFrame,
  type DataQueryError,
  LoadingState,
  type PanelData,
  transformPanelData,
} from '@grafana/data';

import { usePanelContext } from './PanelContext';
import { useAdHocTransformations } from './useAdHocTransformations';

/**
 * @alpha -- experimental
 */
export interface TransformedPanelData {
  /**
   * Transformed data with field config applied. Identical to the input when the panel does not own
   * the pipeline, so it is safe to use unconditionally.
   */
  data: PanelData;

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
 * Applies the panel's own transformation pipeline, for panels that declare `adHocTransforms: true`
 * in their plugin.json and therefore receive untransformed data.
 *
 * Returns `input` unchanged when the panel does not own the pipeline, so a panel can adopt this
 * with a single line and keep working in every host (Explore, alert previews, plugin-hosted
 * panels) where ad-hoc transformations are unavailable.
 *
 * Field config is applied *after* the transformations, which is what the normal pipeline does and
 * what makes transformations that rename or create fields render correctly. Note this means the
 * returned data went through field config exactly once, from pre-field-config source data — do not
 * mix frames from `props.data` with frames from here.
 *
 * @alpha -- experimental
 */
export function useTransformedData(input: PanelData): TransformedPanelData {
  const { getUntransformedData, applyFieldConfig } = usePanelContext();
  const { enabled, transformations } = useAdHocTransformations();

  const active = enabled && transformations.length > 0;
  const source = (active && getUntransformedData?.()) || input;

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
    const subscription = transformPanelData(transformations, source).subscribe({
      next: (transformed) => {
        setResult({ series: transformed.series, annotations: transformed.annotations });
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
  }, [active, transformations, source.series, source.annotations]);

  // Field config is the expensive part, so it only re-runs when the frames themselves change.
  const withFieldConfig = useMemo(() => {
    if (!result) {
      return undefined;
    }

    if (!compareArrayValues(result.series, prevSeries.current, compareDataFrameStructures)) {
      structureRev.current++;
      prevSeries.current = result.series;
    }

    const next: PanelData = { ...source, series: result.series, annotations: result.annotations };

    return applyFieldConfig ? applyFieldConfig(next) : next;
    // `source` is excluded on purpose — only the frames matter here, and including it would
    // re-apply field config on every metadata change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, applyFieldConfig]);

  const data = useMemo(() => {
    if (!active) {
      return input;
    }

    if (!withFieldConfig) {
      // First run: hold back the untransformed frames rather than flashing them for a tick.
      return isTransforming ? { ...input, state: LoadingState.Loading } : input;
    }

    return {
      ...withFieldConfig,
      structureRev: structureRev.current,
      // Metadata always comes from the current source, so a refresh is reflected immediately even
      // while the previous transformed frames are still on screen.
      state: error ? LoadingState.Error : source.state,
      request: source.request,
      timeRange: source.timeRange,
      errors: error ? [...(source.errors ?? []), error] : source.errors,
    };
  }, [active, input, withFieldConfig, isTransforming, error, source]);

  return { data, isTransforming, error };
}
