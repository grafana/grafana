import { mergeMap, from } from 'rxjs';

import { DataFrame, DataTransformerID, DataTransformerInfo, FieldType } from '@grafana/data';
import { createGeometryCollection, createLineBetween } from 'app/features/geo/format/utils';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';

import { SpatialOperation, SpatialAction, SpatialTransformOptions } from './models.gen';
import { doGeomeryCalculation, toLineString } from './utils';

export const spatialTransformer: DataTransformerInfo<SpatialTransformOptions> = {
  id: DataTransformerID.spatial,
  name: 'Spatial operations',
  description: 'Apply spatial operations to query results.',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(mergeMap((data) => from(doSetGeometry(data, options)))),
};

export function isLineBuilderOption(options: SpatialTransformOptions): boolean {
  return options.action === SpatialAction.Modify && options.modify?.op === SpatialOperation.LineBuilder;
}

async function doSetGeometry(frames: DataFrame[], options: SpatialTransformOptions): Promise<DataFrame[]> {
  const location = await getLocationMatchers(options.source);
  if (isLineBuilderOption(options)) {
    const targetLocation = await getLocationMatchers(options.modify?.target);
    return frames.map((frame) => {
      const src = getGeometryField(frame, location);
      const target = getGeometryField(frame, targetLocation);
      if (src.field && target.field) {
        const fields = [...frame.fields];
        const line = createLineBetween(src.field, target.field);
        const first = fields[0];
        if (first.type === FieldType.geo && first !== src.field && first !== target.field) {
          fields[0] = createGeometryCollection(first, line); //
        } else {
          fields.unshift(line);
        }
        return {
          ...frame,
          fields,
        };
      }
      return frame;
    });
  }

  return frames.map((frame) => {
    let info = getGeometryField(frame, location);
    if (info.field) {
      if (options.action === SpatialAction.Modify) {
        switch (options.modify?.op) {
          // SOON: extent, convex hull, etc
          case SpatialOperation.AsLine:
            let name = info.field.name;
            if (!name || name === 'Point') {
              name = 'Line';
            }
            return {
              ...frame,
              length: 1,
              fields: [
                {
                  ...info.field,
                  name,
                  type: FieldType.geo,
                  values: [toLineString(info.field)],
                },
              ],
            };
        }
        return frame;
      }

      const fields = info.derived ? [info.field, ...frame.fields] : frame.fields.slice(0);
      if (options.action === SpatialAction.Calculate) {
        fields.push(doGeomeryCalculation(info.field, options.calculate ?? {}));
        info.derived = true;
      }

      if (info.derived) {
        return {
          ...frame,
          fields,
        };
      }
    }
    return frame;
  });
}
