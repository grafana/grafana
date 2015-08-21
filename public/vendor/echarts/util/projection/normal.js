/**
 * echarts地图一般投射算法
 * modify from GeoMap v0.5.3 https://github.com/x6doooo/GeoMap
 * 
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function() {
    function getBbox(json, specialArea) {
        specialArea = specialArea || {};
        if (!json.srcSize) {
            parseSrcSize(json, specialArea);
        }
        
        return json.srcSize;
    }
    
    function parseSrcSize(json, specialArea) {
        specialArea = specialArea || {};
        convertorParse.xmin = 360;
        convertorParse.xmax = -360;
        convertorParse.ymin = 180;
        convertorParse.ymax = -180;

        var shapes = json.features;
        var geometries;
        var shape;
        for (var i = 0, len = shapes.length; i < len; i++) {
            shape = shapes[i];
            if (shape.properties.name && specialArea[shape.properties.name]) {
                continue;
            }

            switch (shape.type) {
                case 'Feature':
                    convertorParse[shape.geometry.type](shape.geometry.coordinates);
                    break;
                case 'GeometryCollection' :
                    geometries = shape.geometries;
                    for (var j = 0, len2 = geometries.length; j < len2; j++) {
                        convertorParse[geometries[j].type](
                            geometries[j].coordinates
                        );
                    }
                    break;
            }
        }

        json.srcSize = {
            left: convertorParse.xmin.toFixed(4)*1,
            top: convertorParse.ymin.toFixed(4)*1,
            width: (convertorParse.xmax - convertorParse.xmin).toFixed(4)*1,
            height: (convertorParse.ymax - convertorParse.ymin).toFixed(4)*1
        };

        return json;
    }

    var convertor = {
        //调整俄罗斯东部到地图右侧与俄罗斯相连
        formatPoint: function (p) {
            return [
                ((p[0] < -168.5 && p[1] > 63.8) ? p[0] + 360 : p[0]) + 168.5, 
                90 - p[1]
            ];
        },
        makePoint: function (p) {
            var self = this;
            var point = self.formatPoint(p);
            // for cp
            if (self._bbox.xmin > p[0]) { self._bbox.xmin = p[0]; }
            if (self._bbox.xmax < p[0]) { self._bbox.xmax = p[0]; }
            if (self._bbox.ymin > p[1]) { self._bbox.ymin = p[1]; }
            if (self._bbox.ymax < p[1]) { self._bbox.ymax = p[1]; }
            var x = (point[0] - convertor.offset.x) * convertor.scale.x
                    + convertor.offset.left;
            var y = (point[1] - convertor.offset.y) * convertor.scale.y
                    + convertor.offset.top;
            return [x, y];
        },
        Point: function (coordinates) {
            coordinates = this.makePoint(coordinates);
            return coordinates.join(',');
        },
        LineString: function (coordinates) {
            var str = '';
            var point;
            for (var i = 0, len = coordinates.length; i < len; i++) {
                point = convertor.makePoint(coordinates[i]);
                if (i === 0) {
                    str = 'M' + point.join(',');
                } else {
                    str = str + 'L' + point.join(',');
                }
            }
            return str;
        },
        Polygon: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str = str + convertor.LineString(coordinates[i]) + 'z';
            }
            return str;
        },
        MultiPoint: function (coordinates) {
            var arr = [];
            for (var i = 0, len = coordinates.length; i < len; i++) {
                arr.push(convertor.Point(coordinates[i]));
            }
            return arr;
        },
        MultiLineString: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str += convertor.LineString(coordinates[i]);
            }
            return str;
        },
        MultiPolygon: function (coordinates) {
            var str = '';
            for (var i = 0, len = coordinates.length; i < len; i++) {
                str += convertor.Polygon(coordinates[i]);
            }
            return str;
        }
    };
    
    var convertorParse = {
        formatPoint: convertor.formatPoint,

        makePoint: function (p) {
            var self = this;
            var point = self.formatPoint(p);
            var x = point[0];
            var y = point[1];
            if (self.xmin > x) { self.xmin = x; }
            if (self.xmax < x) { self.xmax = x; }
            if (self.ymin > y) { self.ymin = y; }
            if (self.ymax < y) { self.ymax = y; }
        },
        Point: function (coordinates) {
            this.makePoint(coordinates);
        },
        LineString: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.makePoint(coordinates[i]);
            }
        },
        Polygon: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.LineString(coordinates[i]);
            }
        },
        MultiPoint: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.Point(coordinates[i]);
            }
        },
        MultiLineString: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.LineString(coordinates[i]);
            }
        },
        MultiPolygon: function (coordinates) {
            for (var i = 0, len = coordinates.length; i < len; i++) {
                this.Polygon(coordinates[i]);
            }
        }
    };

    function geoJson2Path(json, transform, specialArea) {
        specialArea = specialArea || {};
        convertor.scale = null;
        convertor.offset = null;

        if (!json.srcSize) {
            parseSrcSize(json, specialArea);
        }
        
        transform.offset = {
            x: json.srcSize.left,
            y: json.srcSize.top,
            left: transform.OffsetLeft || 0,
            top: transform.OffsetTop || 0
        };

        convertor.scale = transform.scale;
        convertor.offset = transform.offset;
        
        var shapes = json.features;
        var geometries;
        var pathArray = [];
        var val;
        var shape;
        for (var i = 0, len = shapes.length; i < len; i++) {
            shape = shapes[i];
            if (shape.properties.name && specialArea[shape.properties.name]) {
                // 忽略specialArea
                continue;
            }
            if (shape.type == 'Feature') {
                pushApath(shape.geometry, shape);
            } 
            else if (shape.type == 'GeometryCollection') {
                geometries = shape.geometries;
                for (var j = 0, len2 = geometries.length; j < len2; j++) {
                    val = geometries[j];
                    pushApath(val, val);
                }
            }
        }
        
        var shapeType;
        var shapeCoordinates;
        var str;
        function pushApath(gm, shape) {
            shapeType = gm.type;
            shapeCoordinates = gm.coordinates;
            convertor._bbox = {
                xmin: 360,
                xmax: -360,
                ymin: 180,
                ymax: -180
            };
            str = convertor[shapeType](shapeCoordinates);
            pathArray.push({
                // type: shapeType,
                path: str,
                cp: shape.properties.cp
                    ? convertor.makePoint(shape.properties.cp)
                    : convertor.makePoint([
                           (convertor._bbox.xmin + convertor._bbox.xmax) / 2,
                           (convertor._bbox.ymin + convertor._bbox.ymax) / 2
                      ]),
                properties: shape.properties,
                id: shape.id
            });
        }

        return pathArray;
    }

    /**
     * 平面坐标转经纬度
     * @param {Array} p
     */
    function pos2geo(obj, p) {
        var x;
        var y;
        if (p instanceof Array) {
            x = p[0] * 1;
            y = p[1] * 1;
        }
        else {
            x = p.x * 1;
            y = p.y * 1;
        }
        
        x = x / obj.scale.x + obj.offset.x - 168.5;
        x = x > 180 ? x - 360 : x;
        y = 90 - (y / obj.scale.y + obj.offset.y);
        return [x, y];
    }
    
    /**
     * 经纬度转平面坐标
     * @param {Array | Object} p
     */
    function geo2pos(obj, p) {
        convertor.offset = obj.offset;
        convertor.scale = obj.scale;
        return p instanceof Array
               ? convertor.makePoint([p[0] * 1, p[1] * 1])
               : convertor.makePoint([p.x * 1, p.y * 1]);
    }
    
    return {
        getBbox: getBbox,
        geoJson2Path: geoJson2Path,
        pos2geo: pos2geo,
        geo2pos: geo2pos
    };
}); 