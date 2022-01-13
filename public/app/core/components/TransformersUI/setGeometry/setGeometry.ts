import { DataFrame, DataTransformerID, DataTransformerInfo, FrameGeometrySource } from '@grafana/data';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { mergeMap, from } from 'rxjs';

export interface SetGeometryOptions {
  source?: FrameGeometrySource;
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

  return frames.map((frame) => {
    const info = getGeometryField(frame, location);
    if (info.field && info.derived) {
      return {
        ...frame,
        fields: [info.field, ...frame.fields],
      };
    }
    return frame;
  });
}
