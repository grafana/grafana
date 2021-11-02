/**
 * Function that decodes input geohash into latitude and longitude
 */
export function decodeGeohash(geohash) {
    if (!(geohash === null || geohash === void 0 ? void 0 : geohash.length)) {
        return undefined;
    }
    var BITS = [16, 8, 4, 2, 1];
    var BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    var isEven = true;
    var lat = [];
    var lon = [];
    lat[0] = -90.0;
    lat[1] = 90.0;
    lon[0] = -180.0;
    lon[1] = 180.0;
    var base32Decoded;
    geohash.split('').forEach(function (item) {
        base32Decoded = BASE32.indexOf(item);
        BITS.forEach(function (mask) {
            if (isEven) {
                refineInterval(lon, base32Decoded, mask);
            }
            else {
                refineInterval(lat, base32Decoded, mask);
            }
            isEven = !isEven;
        });
    });
    var latCenter = (lat[0] + lat[1]) / 2;
    var lonCenter = (lon[0] + lon[1]) / 2;
    return [lonCenter, latCenter];
}
function refineInterval(interval, base32Decoded, mask) {
    /* tslint:disable no-bitwise*/
    if (base32Decoded & mask) {
        interval[0] = (interval[0] + interval[1]) / 2;
    }
    else {
        interval[1] = (interval[0] + interval[1]) / 2;
    }
}
//# sourceMappingURL=geohash.js.map