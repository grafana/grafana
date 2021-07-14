import { DataFrame, toDataFrame, FieldType } from '@grafana/data';
import { dataFrameToPoints, decodeGeohash } from './utils';

describe('Format DataFrame into Points', () => {

  describe('Query includes coordinate location data', () => {
    it('creates a point with latitude and longitude coordinates', () => {
      const points = dataFrameToPoints(simpleCoordinateQuery, coordinateConfig.fieldMapping, coordinateConfig.queryFormat);

      // Check x-coordinates
      expect(points[0].getCoordinates()[0]).toBeCloseTo(0);
      expect(points[1].getCoordinates()[0]).toBeCloseTo(-8248774.27);
      // Check y-coordinates
      expect(points[0].getCoordinates()[1]).toBeCloseTo(0);
      expect(points[1].getCoordinates()[1]).toBeCloseTo(4968191.93);
    });
  });

  describe('Query includes geohash location data', () => {
    it('creates a point with latitude and longitude coordinates', () => {
      const points = dataFrameToPoints(simpleGeohashQuery, geohashConfig.fieldMapping, geohashConfig.queryFormat);

      // Check x-coordinates
      expect(points[0].getCoordinates()[0]).toBeCloseTo(-13582554.18);
      expect(points[1].getCoordinates()[0]).toBeCloseTo(-8235631.18);
      // Check y-coordinates
      expect(points[0].getCoordinates()[1]).toBeCloseTo(4436316.69);
      expect(points[1].getCoordinates()[1]).toBeCloseTo(4970443.44);
    });
  });
});

describe('Decode geohash', () => {
  it('transforms a geohash to coordinates', () => {
    const sampleGeohash1 = '9q94r';
    const sampleGeohash2 = 'dr5rs14';
    const decodedGeohash1 = decodeGeohash(sampleGeohash1);
    const decodedGeohash2 = decodeGeohash(sampleGeohash2);

    // Check longitudes
    expect(decodedGeohash1.longitude).toBeCloseTo(-122.014);
    expect(decodedGeohash2.longitude).toBeCloseTo(-74.0005);
    // Check latitudes
    expect(decodedGeohash1.latitude).toBeCloseTo(36.98);
    expect(decodedGeohash2.latitude).toBeCloseTo(40.6995);
  });
});

const coordinateConfig = {
  queryFormat: {
    locationType: 'coordinates',
  },
  fieldMapping: {
    metricField: 'metric',
    geohashField: '',
    latitudeField: 'latitude',
    longitudeField: 'longitude',
  }
};

const geohashConfig = {
  queryFormat: {
    locationType: 'geohash',
  },
  fieldMapping: {
    metricField: 'metric',
    geohashField: 'geohash',
    latitudeField: '',
    longitudeField: '',
  }
};

// Create data frame with coordinate location data
const coordinateValues = [5, 10];
const longitude = [0, -74.1];
const latitude = [0, 40.7];
const simpleCoordinateQuery: DataFrame = toDataFrame({
    name: "simpleCoordinateQuery",
    fields: [
        { name: "metric", type: FieldType.number, values: coordinateValues },
        { name: "longitude", type: FieldType.number, values: longitude },
        { name: "latitude", type: FieldType.number, values: latitude }
    ]
});

// Create data frame with geohash location data
const geohashValues = [5, 10];
const geohash = ['9q94r', 'dr5rs'];
const simpleGeohashQuery: DataFrame = toDataFrame({
  name: "simpleGeohashQuery",
  fields: [
      { name: "metric", type: FieldType.number, values: geohashValues },
      { name: "geohash", type: FieldType.string, values: geohash }
  ]
});
