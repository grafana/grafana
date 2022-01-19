import { DataFrame, DataTransformerID, DataTransformerInfo } from '@grafana/data';
import { createLineBetween } from 'app/features/geo/format/utils';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { mergeMap, from } from 'rxjs';
import { ModifyFunction, SetGeometryAction, SetGeometryOptions } from './models.gen';
import { doGeomeryCalculation, toLineStringField } from './utils';

export const setGeometryTransformer: DataTransformerInfo<SetGeometryOptions> = {
  id: DataTransformerID.setGeometry,
  name: 'Set geometry field',
  description: 'Update the geometry field',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(mergeMap((data) => from(doSetGeometry(data, options)))),
};

export function isLineToOption(options: SetGeometryOptions): boolean {
  return options.action === SetGeometryAction.Modify && options.modify?.fn === ModifyFunction.LineTo;
}

async function doSetGeometry(frames: DataFrame[], options: SetGeometryOptions): Promise<DataFrame[]> {
  const location = await getLocationMatchers(options.source);
  if (isLineToOption(options)) {
    const targetLocation = await getLocationMatchers(options.modify?.lineTo);
    return frames.map((frame) => {
      const src = getGeometryField(frame, location);
      const target = getGeometryField(frame, targetLocation);
      if (src.field && target.field) {
        const line = createLineBetween(src.field, target.field);
        return {
          ...frame,
          fields: [line, ...frame.fields],
        };
      }
      return frame;
    });
  }

  return frames.map((frame) => {
    let info = getGeometryField(frame, location);
    if (info.field) {
      if (options.action === SetGeometryAction.Modify) {
        switch (options.modify?.fn) {
          // SOON: extent, convex hull, etc
          case ModifyFunction.AsLine:
            return {
              ...frame,
              fields: [toLineStringField(info.field)],
            };
        }
        return frame;
      }

      const fields = info.derived ? [info.field, ...frame.fields] : frame.fields.slice(0);
      if (options.action === SetGeometryAction.Calculate) {
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
