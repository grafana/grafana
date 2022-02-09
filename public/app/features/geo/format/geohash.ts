/**
 * Function that decodes input geohash into latitude and longitude
 */
export function decodeGeohash(geohash: string): [number, number] | undefined {
  if (!geohash?.length) {
    return undefined;
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
    BITS.forEach((mask) => {
      if (isEven) {
        refineInterval(lon, base32Decoded, mask);
      } else {
        refineInterval(lat, base32Decoded, mask);
      }
      isEven = !isEven;
    });
  });
  const latCenter = (lat[0] + lat[1]) / 2;
  const lonCenter = (lon[0] + lon[1]) / 2;

  return [lonCenter, latCenter];
}

function refineInterval(interval: any[], base32Decoded: number, mask: number) {
  /* tslint:disable no-bitwise*/
  if (base32Decoded & mask) {
    interval[0] = (interval[0] + interval[1]) / 2;
  } else {
    interval[1] = (interval[0] + interval[1]) / 2;
  }
}
