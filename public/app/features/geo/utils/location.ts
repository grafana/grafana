import { Geometry } from 'ol/geom';

import {
  FieldMatcher,
  getFieldMatcher,
  FieldMatcherID,
  DataFrame,
  Field,
  getFieldDisplayName,
  FieldType,
} from '@grafana/data';
import { FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';

import { getGeoFieldFromGazetteer, pointFieldFromGeohash, pointFieldFromLonLat } from '../format/utils';
import { getGazetteer, Gazetteer } from '../gazetteer/gazetteer';

export type FieldFinder = (frame: DataFrame) => Field | undefined;

function getFieldFinder(matcher: FieldMatcher): FieldFinder {
  return (frame: DataFrame) => {
    for (const field of frame.fields) {
      if (matcher(field, frame, [])) {
        return field;
      }
    }
    return undefined;
  };
}

function matchLowerNames(names: Set<string>): FieldFinder {
  return (frame: DataFrame) => {
    for (const field of frame.fields) {
      if (names.has(field.name.toLowerCase())) {
        return field;
      }
      const disp = getFieldDisplayName(field, frame);
      if (names.has(disp)) {
        return field;
      }
    }
    return undefined;
  };
}

export interface LocationFieldMatchers {
  mode: FrameGeometrySourceMode;

  // Field mappings
  geohash: FieldFinder;
  latitude: FieldFinder;
  longitude: FieldFinder;
  h3: FieldFinder;
  wkt: FieldFinder;
  lookup: FieldFinder;
  geo: FieldFinder;
  gazetteer?: Gazetteer;
}

const defaultMatchers: LocationFieldMatchers = {
  mode: FrameGeometrySourceMode.Auto,
  geohash: matchLowerNames(new Set(['geohash'])),
  latitude: matchLowerNames(new Set(['latitude', 'lat'])),
  longitude: matchLowerNames(new Set(['longitude', 'lon', 'lng'])),
  h3: matchLowerNames(new Set(['h3'])),
  wkt: matchLowerNames(new Set(['wkt'])),
  lookup: matchLowerNames(new Set(['lookup'])),
  geo: (frame: DataFrame) => frame.fields.find((f) => f.type === FieldType.geo),
};

export async function getLocationMatchers(src?: FrameGeometrySource): Promise<LocationFieldMatchers> {
  const info: LocationFieldMatchers = {
    ...defaultMatchers,
    mode: src?.mode ?? FrameGeometrySourceMode.Auto,
  };
  info.gazetteer = await getGazetteer(src?.gazetteer); // Always have gazetteer selected (or default) for smooth transition
  switch (info.mode) {
    case FrameGeometrySourceMode.Geohash:
      if (src?.geohash) {
        info.geohash = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.geohash }));
      } else {
        info.geohash = () => undefined; // In manual mode, don't automatically find field
      }
      break;
    case FrameGeometrySourceMode.Lookup:
      if (src?.lookup) {
        info.lookup = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.lookup }));
      } else {
        info.lookup = () => undefined; // In manual mode, don't automatically find field
      }
      break;
    case FrameGeometrySourceMode.Coords:
      if (src?.latitude) {
        info.latitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.latitude }));
      } else {
        info.latitude = () => undefined; // In manual mode, don't automatically find field
      }
      if (src?.longitude) {
        info.longitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.longitude }));
      } else {
        info.longitude = () => undefined; // In manual mode, don't automatically find field
      }
      break;
  }
  return info;
}
export interface LocationFields {
  mode: FrameGeometrySourceMode;

  // Field mappings
  geohash?: Field;
  latitude?: Field;
  longitude?: Field;
  h3?: Field;
  wkt?: Field;
  lookup?: Field;
  geo?: Field<Geometry>;
}

export function getLocationFields(frame: DataFrame, location: LocationFieldMatchers): LocationFields {
  const fields: LocationFields = {
    mode: location.mode ?? FrameGeometrySourceMode.Auto,
  };

  // Find the best option
  if (fields.mode === FrameGeometrySourceMode.Auto) {
    fields.geo = location.geo(frame);
    if (fields.geo) {
      return fields;
    }

    fields.latitude = location.latitude(frame);
    fields.longitude = location.longitude(frame);
    if (fields.latitude && fields.longitude) {
      fields.mode = FrameGeometrySourceMode.Coords;
      return fields;
    }
    fields.geohash = location.geohash(frame);
    if (fields.geohash) {
      fields.mode = FrameGeometrySourceMode.Geohash;
      return fields;
    }
    fields.lookup = location.lookup(frame);
    if (fields.lookup) {
      fields.mode = FrameGeometrySourceMode.Lookup;
      return fields;
    }
  }

  switch (fields.mode) {
    case FrameGeometrySourceMode.Coords:
      fields.latitude = location.latitude(frame);
      fields.longitude = location.longitude(frame);
      break;
    case FrameGeometrySourceMode.Geohash:
      fields.geohash = location.geohash(frame);
      break;
    case FrameGeometrySourceMode.Lookup:
      fields.lookup = location.lookup(frame);
      break;
  }

  return fields;
}

export interface FrameGeometryField {
  field?: Field<Geometry | undefined>;
  warning?: string;
  derived?: boolean;
  description?: string;
}

export function getGeometryField(frame: DataFrame, location: LocationFieldMatchers): FrameGeometryField {
  const fields = getLocationFields(frame, location);
  switch (fields.mode) {
    case FrameGeometrySourceMode.Auto:
      if (fields.geo) {
        return {
          field: fields.geo,
        };
      }
      return {
        warning: 'Unable to find location fields',
      };

    case FrameGeometrySourceMode.Coords:
      if (fields.latitude && fields.longitude) {
        return {
          field: pointFieldFromLonLat(fields.longitude, fields.latitude),
          derived: true,
          description: `${fields.mode}: ${fields.latitude.name}, ${fields.longitude.name}`,
        };
      }
      return {
        warning: 'Select latitude/longitude fields',
      };

    case FrameGeometrySourceMode.Geohash:
      if (fields.geohash) {
        return {
          field: pointFieldFromGeohash(fields.geohash),
          derived: true,
          description: `${fields.mode}`,
        };
      }
      return {
        warning: 'Select geohash field',
      };

    case FrameGeometrySourceMode.Lookup:
      if (fields.lookup) {
        if (location.gazetteer) {
          return {
            field: getGeoFieldFromGazetteer(location.gazetteer, fields.lookup),
            derived: true,
            description: `${fields.mode}: ${location.gazetteer.path}`, // TODO get better name for this
          };
        }
        return {
          warning: 'Gazetteer not found',
        };
      }
      return {
        warning: 'Select lookup field',
      };
  }

  return { warning: 'unable to find geometry' };
}
