import { useEffect, useState } from 'react';
import { of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { LoadingState, type PanelData, transformPanelData } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { SceneDataTransformer, sceneGraph, type SceneDataProvider } from '@grafana/scenes';
import { type DataTransformerConfig } from '@grafana/schema';

/**
 * True when this provider holds a transformation pipeline it is deliberately not executing,
 * because the panel plugin owns it.
 */
export function isBypassedDataTransformer(dataProvider: SceneDataProvider | undefined): boolean {
  return (
    dataProvider instanceof SceneDataTransformer &&
    Boolean(dataProvider.state.skipTransformations) &&
    dataProvider.state.transformations.length > 0
  );
}

/**
 * Runs a bypassed transformer's pipeline on demand.
 *
 * Anything that wants the *transformed* result of a panel that owns its own pipeline has to run
 * that pipeline itself, because the transformer only passes source data through. Used by the
 * dashboard datasource (`withTransforms`), panel inspect, and the panel editor's transformation
 * preview — all of which would otherwise silently show untransformed data.
 *
 * Returns the input unchanged when the provider is not a bypassed transformer, so callers can
 * route through this unconditionally.
 */
export function runPanelTransformations(
  dataProvider: SceneDataProvider | undefined,
  data: PanelData
): Observable<PanelData> {
  if (!isBypassedDataTransformer(dataProvider) || !(dataProvider instanceof SceneDataTransformer)) {
    return of(data);
  }

  const transformations = dataProvider.state.transformations.filter(
    (t): t is DataTransformerConfig => typeof t === 'object' && t !== null && 'id' in t
  );

  if (transformations.length === 0) {
    return of(data);
  }

  // SceneDataTransformer interpolates before transforming and transformDataFrame skips
  // interpolation inside a scene, so it has to happen here too.
  const interpolated: DataTransformerConfig[] = JSON.parse(
    sceneGraph.interpolate(dataProvider, JSON.stringify(transformations), data.request?.scopedVars)
  );

  return transformPanelData(interpolated, data).pipe(
    catchError((err) => {
      const error = toDataQueryError(err);
      error.message = `Error transforming data: ${error.message}`;

      return of({
        ...data,
        state: LoadingState.Error,
        errors: [...(data.errors ?? []), error],
      });
    })
  );
}

/**
 * React flavour of {@link runPanelTransformations}, for panel inspect and the panel editor's
 * transformation preview. Returns `data` untouched unless the provider is a bypassed transformer,
 * in which case it returns the transformed result once it resolves.
 */
export function useRunPanelTransformations(
  dataProvider: SceneDataProvider | undefined,
  data: PanelData | undefined
): PanelData | undefined {
  const [transformed, setTransformed] = useState<PanelData | undefined>(undefined);
  const bypassed = isBypassedDataTransformer(dataProvider);

  // With the pipeline bypassed `state.data` keeps the same identity when transformations change,
  // so the configs have to be part of the dependencies for edits to take effect.
  const transformationsKey =
    bypassed && dataProvider instanceof SceneDataTransformer
      ? JSON.stringify(dataProvider.state.transformations)
      : undefined;

  useEffect(() => {
    if (!bypassed || !data) {
      setTransformed(undefined);
      return;
    }

    const subscription = runPanelTransformations(dataProvider, data).subscribe(setTransformed);

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bypassed, dataProvider, data, transformationsKey]);

  if (!bypassed) {
    return data;
  }

  return transformed ?? data;
}
