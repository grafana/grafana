import { decodeGeohash } from './geohash';

describe('Read GeoHASH', () => {
  it('simple decode', () => {
    expect(decodeGeohash('9q94r')).toEqual([-122.01416015625, 36.97998046875]);
    expect(decodeGeohash('dr5rs')).toEqual([-73.98193359375, 40.71533203125]);
  });
});
