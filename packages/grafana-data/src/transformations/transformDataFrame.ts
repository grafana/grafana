import { MonoTypeOperatorFunction, Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { DataFrame } from '../types/dataFrame';
import {
  CustomTransformOperator,
  DataTransformContext,
  DataTransformerConfig,
  FrameMatcher,
} from '../types/transformations';

import { getFrameMatchers } from './matchers';
import { standardTransformersRegistry, TransformerRegistryItem } from './standardTransformersRegistry';

const getOperator =
  (config: DataTransformerConfig, ctx: DataTransformContext): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) => {
    const info = standardTransformersRegistry.get(config.id);

    if (!info) {
      return source;
    }

    const defaultOptions = info.transformation.defaultOptions ?? {};
    const options = { ...defaultOptions, ...config.options };

    const matcher = config.filter?.options ? getFrameMatchers(config.filter) : undefined;
    return source.pipe(
      mergeMap((before) =>
        of(filterInput(before, matcher)).pipe(
          info.transformation.operator(options, ctx),
          postProcessTransform(before, info, matcher)
        )
      )
    );
  };

function filterInput(data: DataFrame[], matcher?: FrameMatcher) {
  if (matcher) {
    return data.filter((v) => matcher(v));
  }
  return data;
}

const postProcessTransform =
  (before: DataFrame[], info: TransformerRegistryItem, matcher?: FrameMatcher): MonoTypeOperatorFunction<DataFrame[]> =>
  (source) =>
    source.pipe(
      map((after) => {
        if (after === before) {
          return after;
        }

        // Add back the filtered out frames
        if (matcher) {
          // keep the frame order the same
          let insert = 0;
          const append = before.filter((v, idx) => {
            const keep = !matcher(v);
            if (keep && !insert) {
              insert = idx;
            }
            return keep;
          });
          if (append.length) {
            after.splice(insert, 0, ...append);
          }
        }
        return after;
      })
    );

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(
  options: Array<DataTransformerConfig | CustomTransformOperator>,
  data: DataFrame[],
  ctx?: DataTransformContext
): Observable<DataFrame[]> {
  const stream = of<DataFrame[]>(data);

  if (!options.length) {
    return stream;
  }

  const operators: Array<MonoTypeOperatorFunction<DataFrame[]>> = [];
  const context = ctx ?? { interpolate: (str) => str };

  for (let index = 0; index < options.length; index++) {
    const config = options[index];

    if (isCustomTransformation(config)) {
      operators.push(config(context));
    } else {
      if (config.disabled) {
        continue;
      }
      operators.push(getOperator(config, context));
    }
  }

  // @ts-ignore TypeScript has a hard time understanding this construct
  return stream.pipe.apply(stream, operators);
}

function isCustomTransformation(t: DataTransformerConfig | CustomTransformOperator): t is CustomTransformOperator {
  return typeof t === 'function';
}
