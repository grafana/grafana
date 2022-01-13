import {
  FrameGeometrySource,
  FrameGeometrySourceMode,
  FieldMatcher,
  getFieldMatcher,
  FieldMatcherID,
  DataFrame,
  Field,
  getFieldDisplayName,
  FieldType,
} from '@grafana/data';
import { Geometry } from 'ol/geom';
import { getGazetteer, Gazetteer } from '../gazetteer/gazetteer';
import { getGeoFieldFromGazetteer, pointFieldFromGeohash, pointFieldFromLonLat } from '../format/utils';

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
  switch (info.mode) {
    case FrameGeometrySourceMode.Geohash:
      if (src?.geohash) {
        info.geohash = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.geohash }));
      }
      break;
    case FrameGeometrySourceMode.Lookup:
      if (src?.lookup) {
        info.lookup = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.lookup }));
      }
      info.gazetteer = await getGazetteer(src?.gazetteer);
      break;
    case FrameGeometrySourceMode.Coords:
      if (src?.latitude) {
        info.latitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.latitude }));
      }
      if (src?.longitude) {
        info.longitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.longitude }));
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
    fields.lookup = location.geohash(frame);
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

export function setGeometryOnFrame(frame: DataFrame, location: LocationFieldMatchers): DataFrame {
  let warning: string | undefined = undefined;
  let geo: Field | undefined = undefined;
  const fields = getLocationFields(frame, location);
  switch (fields.mode) {
    case FrameGeometrySourceMode.Auto:
      if (fields.geo) {
        return frame;
      }
      warning = 'Unable to find location fields';
      break;

    case FrameGeometrySourceMode.Coords:
      if (fields.latitude && fields.longitude) {
        geo = pointFieldFromLonLat(fields.longitude, fields.latitude);
      } else {
        warning = 'Missing latitude/longitude fields';
      }
      break;

    case FrameGeometrySourceMode.Geohash:
      if (fields.geohash) {
        geo = pointFieldFromGeohash(fields.geohash);
      } else {
        warning = 'Missing geohash field';
      }
      break;

    case FrameGeometrySourceMode.Lookup:
      if (fields.lookup) {
        if (location.gazetteer) {
          geo = getGeoFieldFromGazetteer(location.gazetteer, fields.lookup);
        } else {
          warning = 'Gazetteer not found';
        }
      } else {
        warning = 'Missing lookup field';
      }
      break;
  }

  if (warning || !geo) {
    const meta = frame.meta ?? {};
    meta.notices = [
      {
        severity: 'error',
        text: warning ?? 'Unable to set geometry field',
      },
    ];
    return {
      ...frame,
      meta,
    };
  }
  return {
    ...frame,
    fields: [geo, ...frame.fields],
  };
}
