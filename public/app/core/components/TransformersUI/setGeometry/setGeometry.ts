import { DataFrame, DataTransformerID, DataTransformerInfo, FrameGeometrySource } from '@grafana/data';
import { getLocationMatchers, setGeometryOnFrame } from 'app/features/geo/utils/location';
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
    return setGeometryOnFrame(frame, location);
  });
}
