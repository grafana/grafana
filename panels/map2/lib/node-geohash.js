/**
 * Copyright (c) 2011, Sun Ning.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

var BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
var BASE32_CODES_DICT = {};
for(var i=0; i<BASE32_CODES.length; i++) {
    BASE32_CODES_DICT[BASE32_CODES.charAt(i)]=i;
}

var encode = function(latitude, longitude, numberOfChars){
    numberOfChars = numberOfChars || 9;
    var chars = [], bits = 0;
    var hash_value = 0;

    var maxlat = 90, minlat = -90;
    var maxlon = 180, minlon = -180;

    var mid;
    var islon = true;
    while(chars.length < numberOfChars) {
        if (islon){
            mid = (maxlon+minlon)/2;
            if(longitude > mid){
                hash_value = (hash_value << 1) + 1;
                minlon=mid;
            } else {
                hash_value = (hash_value << 1) + 0;
                maxlon=mid;
            }
        } else {
            mid = (maxlat+minlat)/2;
            if(latitude > mid ){
                hash_value = (hash_value << 1) + 1;
                minlat = mid;
            } else {
                hash_value = (hash_value << 1) + 0;
                maxlat = mid;
            }
        }
        islon = !islon;

        bits++;
        if (bits == 5) {
            var code = BASE32_CODES[hash_value];
            chars.push(code);
            bits = 0;
            hash_value = 0;
        }
    }
    return chars.join('')
};

var decode_bbox = function(hash_string){
    var islon = true;
    var maxlat = 90, minlat = -90;
    var maxlon = 180, minlon = -180;

    var hash_value = 0;
    for(var i=0,l=hash_string.length; i<l; i++) {
        var code = hash_string[i].toLowerCase();
        hash_value = BASE32_CODES_DICT[code];

        for (var bits=4; bits>=0; bits--) {
            var bit = (hash_value >> bits) & 1;
            if (islon){
                var mid = (maxlon+minlon)/2;
                if(bit == 1){
                    minlon = mid;
                } else {
                    maxlon = mid;
                }
            } else {
                var mid = (maxlat+minlat)/2;
                if(bit == 1){
                    minlat = mid;
                } else {
                    maxlat = mid;
                }
            }
            islon = !islon;
        }
    }
    return [minlat, minlon, maxlat, maxlon];
}

var decode = function(hash_string){
    var bbox = decode_bbox(hash_string);
    var lat = (bbox[0]+bbox[2])/2;
    var lon = (bbox[1]+bbox[3])/2;
    var laterr = bbox[2]-lat;
    var lonerr = bbox[3]-lon;
    return {latitude:lat, longitude:lon,
        error:{latitude:laterr, longitude:lonerr}};
};

/**
 * direction [lat, lon], i.e.
 * [1,0] - north
 * [1,1] - northeast
 * ...
 */
var neighbor = function(hashstring, direction) {
    var lonlat = decode(hashstring);
    var neighbor_lat = lonlat.latitude
        + direction[0] * lonlat.error.latitude * 2;
    var neighbor_lon = lonlat.longitude
        + direction[1] * lonlat.error.longitude * 2;
    return encode(neighbor_lat, neighbor_lon, hashstring.length);
}

var geohash = {
    'encode': encode,
    'decode': decode,
    'decode_bbox': decode_bbox,
    'neighbor': neighbor,
}
module.exports = geohash;
