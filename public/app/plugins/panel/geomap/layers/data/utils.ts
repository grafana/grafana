import { DataFrame, DataFrameView } from '@grafana/data';

interface locations {
  lowestValue: number;
  highestValue: number;
  valueRange: number;
  dataValues: location[];
};

interface location {
  latitude: string;
  longitude: string;
  value: number;
}

 /**
   * Function that formats dataframe into locations
   */
export function dataFrameToLocations(frame: DataFrame, config: any): locations {
  let dataValues: location[] = [];

  let formattedData: locations = {
    lowestValue: 0,
    highestValue: 0,
    valueRange: 0,
    dataValues: dataValues,
  };

  if (frame && frame.length > 0) {

    let lowestValue: number = Number.MAX_VALUE;
    let highestValue: number = 0;

    // For each data point, create a dataValue
    const view = new DataFrameView(frame);

    view.forEach(row => {

      let lat;
      let lng;
      let value;

      // Coordinate Data
      if (config.queryFormat.locationType === "coordinates") {
        lat = row[config.fieldMapping.latitudeField];
        lng = row[config.fieldMapping.longitudeField];
      }

      // Geohash Data
      else if (config.queryFormat.locationType === "geohash"){
        const encodedGeohash = row[config.fieldMapping.geohashField];
        const decodedGeohash = decodeGeohash(encodedGeohash);
        lat = decodedGeohash.latitude;
        lng = decodedGeohash.longitude;
      }

      value = row[config.fieldMapping.metricField];

      // Update highest and lowest value
      if (value > highestValue) {
        highestValue = value;
      }
      if (value < lowestValue) {
          lowestValue = value;
      }

      dataValues.push({latitude: lat, longitude: lng, value: value});

    });
    formattedData.lowestValue = lowestValue;
    formattedData.highestValue = highestValue;
    formattedData.valueRange = highestValue - lowestValue;
  }
  return formattedData;
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
