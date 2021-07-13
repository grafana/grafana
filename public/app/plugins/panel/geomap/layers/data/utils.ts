import { DataFrame, DataFrameView } from '@grafana/data';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { FieldMappingOptions, QueryFormat } from '../../types'

 /**
   * Function that formats dataframe into a Point[]
   */
export function dataFrameToPoints(frame: DataFrame, fieldMapping: FieldMappingOptions, queryFormat: QueryFormat): Point[] {

  let points: Point[] = [];

  if (frame && frame.length > 0) {

    // For each data point, create a Point
    const view = new DataFrameView(frame);
    view.forEach(row => {

      let lng;
      let lat;

      // Coordinate Data
      if (queryFormat.locationType === "coordinates") {
        lng = row[fieldMapping.longitudeField];
        lat = row[fieldMapping.latitudeField];
      }
      // Geohash Data
      else if (queryFormat.locationType === "geohash"){
        const encodedGeohash = row[fieldMapping.geohashField];
        const decodedGeohash = decodeGeohash(encodedGeohash);
        lng = decodedGeohash.longitude;
        lat = decodedGeohash.latitude;
      }
      points.push(new Point(fromLonLat([lng,lat])));
    });
  }
  return points;
}

 /**
   * Function that decodes input geohash into latitude and longitude
   */
function decodeGeohash(geohash: string) {
  if (!geohash || geohash.length === 0) {
    throw new Error('Missing geohash value');
  }
  const BITS = [16, 8, 4, 2, 1];
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  const lat: number[] = [];
  const lon: number[] = [];
  lat[0] = -90.0;
  lat[1] = 90.0;
  lon[0] = -180.0;
  lon[1] = 180.0;
  let base32Decoded: number;

  geohash.split('').forEach((item: string) => {
    base32Decoded = BASE32.indexOf(item);
    BITS.forEach(mask => {
      if (isEven) {
        refineInterval(lon, base32Decoded, mask);
      } 
      else {
        refineInterval(lat, base32Decoded, mask);
      }
      isEven = !isEven;
    });
  });
  const latCenter = (lat[0] + lat[1]) / 2;
  const lonCenter = (lon[0] + lon[1]) / 2;

  return { latitude: latCenter, longitude: lonCenter };
}
  
function refineInterval(interval: any[], base32Decoded: number, mask: number) {
  /* tslint:disable no-bitwise*/
  if (base32Decoded & mask) {
    interval[0] = (interval[0] + interval[1]) / 2;
  } 
  else {
    interval[1] = (interval[0] + interval[1]) / 2;
  }
}
