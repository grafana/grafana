import {
  FrameGeometrySource,
  FrameGeometrySourceMode,
  FieldMatcher,
  getFieldMatcher,
  FieldMatcherID,
  DataFrame,
  Field,
  getFieldDisplayName,
  LookupSourceOptions,
  LookupSourceEndpoints,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { decodeGeohash } from './geohash';

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

  // Lookup Source Endpoint
  lookupSrcEndpoint: string;
}

const defaultMatchers: LocationFieldMatchers = {
  mode: FrameGeometrySourceMode.Auto,
  geohash: matchLowerNames(new Set(['geohash'])),
  latitude: matchLowerNames(new Set(['latitude', 'lat'])),
  longitude: matchLowerNames(new Set(['longitude', 'lon', 'lng'])),
  h3: matchLowerNames(new Set(['h3'])),
  wkt: matchLowerNames(new Set(['wkt'])),
  lookup: matchLowerNames(new Set(['lookup', 'target'])),
  lookupSrcEndpoint: LookupSourceEndpoints.Countries,
};

export function getLocationMatchers(src?: FrameGeometrySource): LocationFieldMatchers {
  const info: LocationFieldMatchers = {
    ...defaultMatchers,
    mode: src?.mode ?? FrameGeometrySourceMode.Auto,
  };
  switch (info.mode) {
    case FrameGeometrySourceMode.Coords:
      if (src?.latitude) {
        info.latitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.latitude }));
      }
      if (src?.longitude) {
        info.longitude = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.longitude }));
      }
      break;
    case FrameGeometrySourceMode.Geohash:
      if (src?.geohash) {
        info.geohash = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.geohash }));
      }
      break;
    case FrameGeometrySourceMode.Lookup:
      if (src?.lookup) {
        info.lookup = getFieldFinder(getFieldMatcher({ id: FieldMatcherID.byName, options: src.lookup }));
      }
      // Lookup source endpoint is Countries
      if (src?.lookupSrc === LookupSourceOptions.Countries) {
        info.lookupSrcEndpoint = LookupSourceEndpoints.Countries;
      }
      // Lookup source endpoint is Countries (3 Letter)
      else if (src?.lookupSrc === LookupSourceOptions.Countries_3Letter) {
        info.lookupSrcEndpoint = LookupSourceEndpoints.Countries_3Letter;
      }
      // Lookup source endpoint is States
      else if (src?.lookupSrc === LookupSourceOptions.States) {
        info.lookupSrcEndpoint = LookupSourceEndpoints.States;
      }
      // Lookup source endpoint is Probes
      else if (src?.lookupSrc === LookupSourceOptions.Probes) {
        info.lookupSrcEndpoint = LookupSourceEndpoints.Probes;
      }
      // Lookup source endpoint is JSON Endpoint
      else if (src?.lookupSrc === LookupSourceOptions.JSONEndpoint && src?.lookupSrcEndpoint) {
        info.lookupSrcEndpoint = src.lookupSrcEndpoint;
      }
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
}

export function getLocationFields(frame: DataFrame, location: LocationFieldMatchers): LocationFields {
  const fields: LocationFields = {
    mode: location.mode ?? FrameGeometrySourceMode.Auto,
  };

  // Find the best option
  if (fields.mode === FrameGeometrySourceMode.Auto) {
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

export interface LocationInfo {
  warning?: string;
  points: Point[];
}

export interface Location {
  name: string;
  longitude: number;
  latitude: number;
}

export function convertLocationJson(locationJson: Location[]): Map<string, Location> {
  let map = new Map<string, Location>();
  for (var value in locationJson) {
    let internal: Location = {
      name: locationJson[value].name,
      longitude: locationJson[value].longitude,
      latitude: locationJson[value].latitude,
    };
    map.set(value, internal);
  }
  return map;
}

export async function dataFrameToPoints(frame: DataFrame, location: LocationFieldMatchers): Promise<LocationInfo> {
  const info: LocationInfo = {
    points: [],
  };
  if (!frame?.length) {
    return info;
  }
  const fields = getLocationFields(frame, location);
  switch (fields.mode) {
    case FrameGeometrySourceMode.Coords:
      if (fields.latitude && fields.longitude) {
        info.points = getPointsFromLonLat(fields.longitude, fields.latitude);
      } else {
        info.warning = 'Missing latitude/longitude fields';
      }
      break;

    case FrameGeometrySourceMode.Geohash:
      if (fields.geohash) {
        info.points = getPointsFromGeohash(fields.geohash);
      } else {
        info.warning = 'Missing geohash field';
      }
      break;

    case FrameGeometrySourceMode.Lookup:
      if (fields.lookup && location.lookupSrcEndpoint) {
        // TODO: Get response from http request
        const locationJson = await getBackendSrv().get(location.lookupSrcEndpoint);
        const locationMap = convertLocationJson(locationJson);

        info.points = getPointsFromLookup(fields.lookup, locationMap);
      } else {
        info.warning = 'Missing lookup/lookupSrc field';
      }
      break;

    case FrameGeometrySourceMode.Auto:
      info.warning = 'Unable to find location fields';
  }
  return info;
}

function getPointsFromLonLat(lon: Field<number>, lat: Field<number>): Point[] {
  const count = lat.values.length;
  const points = new Array<Point>(count);
  for (let i = 0; i < count; i++) {
    points[i] = new Point(fromLonLat([lon.values.get(i), lat.values.get(i)]));
  }
  return points;
}

function getPointsFromGeohash(field: Field<string>): Point[] {
  const count = field.values.length;
  const points = new Array<Point>(count);
  for (let i = 0; i < count; i++) {
    const coords = decodeGeohash(field.values.get(i));
    if (coords) {
      points[i] = new Point(fromLonLat(coords));
    }
  }
  return points;
}

export function getPointsFromLookup(field: Field<string>, locationData: Map<string, Location>): Point[] {
  const count = field.values.length;
  const points = new Array<Point>(count);
  for (let i = 0; i < count; i++) {
    const target = field.values.get(i);
    const location = locationData.get(target.toUpperCase());
    if (location) {
      points[i] = new Point(fromLonLat([location.longitude, location.latitude]));
    }
  }
  return points;
}
