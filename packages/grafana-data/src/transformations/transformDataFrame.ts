import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { DataFrame, DataTransformerConfig } from '../types';
import { standardTransformersRegistry } from './standardTransformersRegistry';

const getTransform = (config: DataTransformerConfig, data: Observable<DataFrame[]>): Observable<DataFrame[]> => {
  const info = standardTransformersRegistry.get(config.id);

  if (!info) {
    return data;
  }

  return data.pipe(
    mergeMap(before => {
      const defaultOptions = info.transformation.defaultOptions ?? {};
      const options = { ...defaultOptions, ...config.options };

      return info.transformation.transformer(options, before).pipe(
        map(after => {
          if (after === before) {
            return after;
          }

          // Add a key to the metadata if the data changed
          for (const series of after) {
            if (!series.meta) {
              series.meta = {};
            }

            if (!series.meta.transformations) {
              series.meta.transformations = [info.id];
            } else {
              series.meta.transformations = [...series.meta.transformations, info.id];
            }
          }

          return after;
        })
      );
    })
  );
};

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(options: DataTransformerConfig[], data: DataFrame[]): Observable<DataFrame[]> {
  if (!options.length) {
    return of(data);
  }

  return of(data).pipe(
    mergeMap(source => {
      const observables: Array<Observable<DataFrame[]>> = [];

      for (let index = 0; index < options.length; index++) {
        const config = options[index];
        const prev = index === 0 ? of(source) : observables[index - 1];
        const curr = prev.pipe(
          mergeMap(d => {
            return getTransform(config, of(d));
          })
        );
        observables.push(curr);
      }

      return observables[observables.length - 1];
    })
  );
}
