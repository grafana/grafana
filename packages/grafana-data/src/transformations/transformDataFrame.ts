import { generate, Observable, of } from 'rxjs';
import { map, mergeMap, scan } from 'rxjs/operators';

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
  return generate(
    0,
    index => index < options.length,
    index => index + 1
  ).pipe(
    scan((acc, index) => {
      return getTransform(options[index], acc);
    }, of(data)),
    mergeMap(data => data)
  );
}
