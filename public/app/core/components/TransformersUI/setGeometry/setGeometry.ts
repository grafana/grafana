import { DataFrame, DataTransformerID, DataTransformerInfo, FrameGeometrySource } from '@grafana/data';
import { createLineBetween } from 'app/features/geo/format/utils';
import { getGeometryField, getLocationMatchers, LocationFieldMatchers } from 'app/features/geo/utils/location';
import { mergeMap, from } from 'rxjs';

export enum SetGeometryAction {
  SetField = 'setField',
  LineTo = 'lineTo',
}

export interface LineToOptions {
  target?: FrameGeometrySource;
  calculateDistance?: boolean;
}

export interface SetGeometryOptions {
  source?: FrameGeometrySource;
  action?: SetGeometryAction;
  lineTo?: LineToOptions;
}

export const setGeometryTransformer: DataTransformerInfo<SetGeometryOptions> = {
  id: DataTransformerID.setGeometry,
  name: 'Set geometry field',
  description: 'Update the geometry field',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(mergeMap((data) => from(doGazetteerXform(data, options)))),
};

async function doGazetteerXform(frames: DataFrame[], options: SetGeometryOptions): Promise<DataFrame[]> {
  const location = await getLocationMatchers(options.source);
  let targetLocation: LocationFieldMatchers | undefined = undefined;
  if (options.action === SetGeometryAction.LineTo) {
    targetLocation = await getLocationMatchers(options.lineTo?.target);
  }

  return frames.map((frame) => {
    let info = getGeometryField(frame, location);
    if (targetLocation && info.field) {
      const target = getGeometryField(frame, targetLocation);
      if (target.field) {
        const out = createLineBetween(info.field, target.field);
        info.field = out;
        info.derived = true;
      }
    }

    if (info.field && info.derived) {
      return {
        ...frame,
        fields: [info.field, ...frame.fields],
      };
    }
    return frame;
  });
}
