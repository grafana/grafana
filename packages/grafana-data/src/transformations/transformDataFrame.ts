import { MonoTypeOperatorFunction, Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { DataFrame, DataTransformerConfig } from '../types';

import { standardTransformersRegistry, TransformerRegistryItem } from './standardTransformersRegistry';

const getOperator =
  (config: DataTransformerConfig): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) => {
    const info = standardTransformersRegistry.get(config.id);

    if (!info) {
      return source;
    }

    const defaultOptions = info.transformation.defaultOptions ?? {};
    const options = { ...defaultOptions, ...config.options };

    return source.pipe(
      mergeMap((before) =>
        of(before).pipe(info.transformation.operator(options, config.replace), postProcessTransform(before, info))
      )
    );
  };

const postProcessTransform =
  (before: DataFrame[], info: TransformerRegistryItem<any>): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) =>
    source.pipe(
      map((after) => {
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

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(options: DataTransformerConfig[], data: DataFrame[]): Observable<DataFrame[]> {
  const stream = of<DataFrame[]>(data);

  if (!options.length) {
    return stream;
  }

  const operators: Array<MonoTypeOperatorFunction<DataFrame[]>> = [];

  for (let index = 0; index < options.length; index++) {
    const config = options[index];

    if (config.disabled) {
      continue;
    }

    operators.push(getOperator(config));
  }

  // @ts-ignore TypeScript has a hard time understanding this construct
  return stream.pipe.apply(stream, operators);
}
