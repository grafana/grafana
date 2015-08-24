/**
 * echarts地图一般投射算法
 * modify from GeoMap v0.5.3 https://github.com/x6doooo/GeoMap
 * 
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 */
define(function(require) {

    var PathShape = require('zrender/shape/Path');
    function toFloat(str) {
        return parseFloat(str || 0);
    }

    function getBbox(root) {
        var svgNode = root.firstChild;
        // Find the svg node
        while (!(svgNode.nodeName.toLowerCase() == 'svg' && svgNode.nodeType == 1)) {
            svgNode = svgNode.nextSibling;
        }

        var x = toFloat(svgNode.getAttribute('x'));
        var y = toFloat(svgNode.getAttribute('y'));
        var width = toFloat(svgNode.getAttribute('width'));
        var height = toFloat(svgNode.getAttribute('height'));
        return {
            left: x,
            top: y,
            width: width,
            height: height
        };
    }
    
    function geoJson2Path(root, transform) {
        var scale = [transform.scale.x, transform.scale.y];
        var elList = [];
        function _getShape(root) {
            var tagName = root.tagName;
            if (shapeBuilders[tagName]) {
                var obj = shapeBuilders[tagName](root, scale);

                if (obj) {
                    // Common attributes
                    obj.scale = scale;
                    obj.properties = {
                        name: root.getAttribute('name') || ''
                    };
                    obj.id = root.id;
                    extendCommonAttributes(obj, root);

                    elList.push(obj);
                }
            }
            var shapes = root.childNodes;
            for (var i = 0, len = shapes.length; i < len; i++) {
                _getShape(shapes[i]);
            }
        }
        _getShape(root);
        return elList;
    }

    /**
     * 平面坐标转经纬度
     * @param {Array} p
     */
    function pos2geo(obj, p) {
        var point = p instanceof Array ? [p[0] * 1, p[1] * 1] : [p.x * 1, p.y * 1];
        return [point[0] / obj.scale.x, point[1] / obj.scale.y];
    }
    
    /**
     * 经纬度转平面坐标
     * @param {Array | Object} p
     */
    function geo2pos(obj, p) {
        var point = p instanceof Array ? [p[0] * 1, p[1] * 1] : [p.x * 1, p.y * 1];
        return [point[0] * obj.scale.x, point[1] * obj.scale.y];
    }

    function trim(str) {
        return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function extendCommonAttributes(obj, xmlNode) {

        var color = xmlNode.getAttribute('fill');
        var strokeColor = xmlNode.getAttribute('stroke');
        var lineWidth = xmlNode.getAttribute('stroke-width');
        var opacity = xmlNode.getAttribute('opacity');

        if (color && color != 'none') {
            obj.color = color;
            if (strokeColor) {
                obj.brushType = 'both';
                obj.strokeColor = strokeColor;
            } else {
                obj.brushType = 'fill';
            }
        } else if (strokeColor && strokeColor != 'none') {
            obj.strokeColor = strokeColor;
            obj.brushType = 'stroke';
        }
        if (lineWidth && lineWidth != 'none') {
            obj.lineWidth = parseFloat(lineWidth);
        }
        if (opacity && opacity != 'none') {
            obj.opacity = parseFloat(opacity);
        }
    }

    function parsePoints(str) {
        var list = trim(str).replace(/,/g, ' ').split(/\s+/);
        var points = [];

        for (var i = 0; i < list.length;) {
            var x = parseFloat(list[i++]);
            var y = parseFloat(list[i++]);
            points.push([x, y]);
        }
        return points;
    }

    // Regular svg shapes
    var shapeBuilders = {
        path: function(xmlNode, scale) {
            var path = xmlNode.getAttribute('d');
            var rect = PathShape.prototype.getRect({ path : path });
            return {
                shapeType: 'path',
                path: path,
                cp: [
                    (rect.x + rect.width / 2) * scale[0], 
                    (rect.y + rect.height / 2) * scale[1]
                ]
            };
        },

        rect: function(xmlNode, scale) {
            var x = toFloat(xmlNode.getAttribute('x'));
            var y = toFloat(xmlNode.getAttribute('y'));
            var width = toFloat(xmlNode.getAttribute('width'));
            var height = toFloat(xmlNode.getAttribute('height'));

            return {
                shapeType: 'rectangle',
                x: x,
                y: y,
                width: width,
                height: height,
                cp: [
                    (x + width / 2) * scale[0], 
                    (y + height / 2) * scale[1]
                ]
            };
        },

        line: function(xmlNode, scale) {
            var x1 = toFloat(xmlNode.getAttribute('x1'));
            var y1 = toFloat(xmlNode.getAttribute('y1'));
            var x2 = toFloat(xmlNode.getAttribute('x2'));
            var y2 = toFloat(xmlNode.getAttribute('y2'));

            return {
                shapeType: 'line',
                xStart: x1,
                yStart: y1,
                xEnd: x2,
                yEnd: y2,
                cp: [
                    (x1 + x2) * 0.5 * scale[0], 
                    (y1 + y2) * 0.5 * scale[1]
                ]
            };
        },

        circle: function(xmlNode, scale) {
            var cx = toFloat(xmlNode.getAttribute('cx'));
            var cy = toFloat(xmlNode.getAttribute('cy'));
            var r = toFloat(xmlNode.getAttribute('r'));

            return {
                shapeType: 'circle',
                x: cx,
                y: cy,
                r: r,
                cp: [
                    cx * scale[0],
                    cy * scale[1]
                ]
            };
        },

        ellipse: function(xmlNode, scale) {
            var cx = parseFloat(xmlNode.getAttribute('cx') || 0);
            var cy = parseFloat(xmlNode.getAttribute('cy') || 0);
            var rx = parseFloat(xmlNode.getAttribute('rx') || 0);
            var ry = parseFloat(xmlNode.getAttribute('ry') || 0);

            return {
                shapeType: 'ellipse',
                x: cx,
                y: cy,
                a: rx,
                b: ry,
                cp: [
                    cx * scale[0],
                    cy * scale[1]
                ]
            };
        },

        polygon: function(xmlNode, scale) {
            var points = xmlNode.getAttribute('points');
            var min = [Infinity, Infinity];
            var max = [-Infinity, -Infinity];
            if (points) {
                points = parsePoints(points);

                for (var i = 0; i < points.length; i++) {
                    var p = points[i];
                    
                    min[0] = Math.min(p[0], min[0]);
                    min[1] = Math.min(p[1], min[1]);

                    max[0] = Math.max(p[0], max[0]);
                    max[1] = Math.max(p[1], max[1]);

                }
                return {
                    shapeType: 'polygon',
                    pointList: points,
                    cp: [
                        (min[0] + max[0]) / 2 * scale[0],
                        (min[1] + max[1]) / 2 * scale[0]
                    ]
                };
            }
        },

        polyline: function(xmlNode, scale) {
            var obj = shapeBuilders.polygon(xmlNode, scale);
            return obj;
        }
    };
    
    return {
        getBbox: getBbox,
        geoJson2Path: geoJson2Path,
        pos2geo: pos2geo,
        geo2pos: geo2pos
    };
}); 