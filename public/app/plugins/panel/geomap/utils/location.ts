import { DataFrame, FrameGeometrySource, Field, FrameGeometrySourceMode } from '@grafana/data';
import { Geometry } from 'ol/geom';

export interface LocationSourceFields {
  mode: FrameGeometrySourceMode;
  warning?: string;

  // Field mappings
  geohash?: Field;
  latitude?: Field;
  longitude?: Field;

  // Lookup source
  lookup?: Map<string, Geometry>;
}

export function getLocationFields(frame: DataFrame, src?: FrameGeometrySource): LocationSourceFields {
  return {
    mode: FrameGeometrySourceMode.Auto,
    warning: 'Unable to find location values',
  };
}
