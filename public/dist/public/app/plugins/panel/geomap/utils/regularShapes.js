import { __read, __values } from "tslib";
import { Fill, RegularShape, Stroke, Style, Circle } from 'ol/style';
import { Registry } from '@grafana/data';
export var RegularShapeId;
(function (RegularShapeId) {
    RegularShapeId["circle"] = "circle";
    RegularShapeId["square"] = "square";
    RegularShapeId["triangle"] = "triangle";
    RegularShapeId["star"] = "star";
    RegularShapeId["cross"] = "cross";
    RegularShapeId["x"] = "x";
})(RegularShapeId || (RegularShapeId = {}));
var MarkerShapePath = {
    circle: 'img/icons/marker/circle.svg',
    square: 'img/icons/marker/square.svg',
    triangle: 'img/icons/marker/triangle.svg',
    star: 'img/icons/marker/star.svg',
    cross: 'img/icons/marker/cross.svg',
    x: 'img/icons/marker/x-mark.svg',
};
export var circleMarker = {
    id: RegularShapeId.circle,
    name: 'Circle',
    hasFill: true,
    aliasIds: [MarkerShapePath.circle],
    make: function (cfg) {
        return new Style({
            image: new Circle({
                stroke: new Stroke({ color: cfg.color }),
                fill: new Fill({ color: cfg.fillColor }),
                radius: cfg.size,
            }),
        });
    },
};
var makers = [
    circleMarker,
    {
        id: RegularShapeId.square,
        name: 'Square',
        hasFill: true,
        aliasIds: [MarkerShapePath.square],
        make: function (cfg) {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({ color: cfg.fillColor }),
                    stroke: new Stroke({ color: cfg.color, width: 1 }),
                    points: 4,
                    radius: cfg.size,
                    angle: Math.PI / 4,
                }),
            });
        },
    },
    {
        id: RegularShapeId.triangle,
        name: 'Triangle',
        hasFill: true,
        aliasIds: [MarkerShapePath.triangle],
        make: function (cfg) {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({ color: cfg.fillColor }),
                    stroke: new Stroke({ color: cfg.color, width: 1 }),
                    points: 3,
                    radius: cfg.size,
                    rotation: Math.PI / 4,
                    angle: 0,
                }),
            });
        },
    },
    {
        id: RegularShapeId.star,
        name: 'Star',
        hasFill: true,
        aliasIds: [MarkerShapePath.star],
        make: function (cfg) {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({ color: cfg.fillColor }),
                    stroke: new Stroke({ color: cfg.color, width: 1 }),
                    points: 5,
                    radius: cfg.size,
                    radius2: cfg.size * 0.4,
                    angle: 0,
                }),
            });
        },
    },
    {
        id: RegularShapeId.cross,
        name: 'Cross',
        hasFill: false,
        aliasIds: [MarkerShapePath.cross],
        make: function (cfg) {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({ color: cfg.fillColor }),
                    stroke: new Stroke({ color: cfg.color, width: 1 }),
                    points: 4,
                    radius: cfg.size,
                    radius2: 0,
                    angle: 0,
                }),
            });
        },
    },
    {
        id: RegularShapeId.x,
        name: 'X',
        hasFill: false,
        aliasIds: [MarkerShapePath.x],
        make: function (cfg) {
            return new Style({
                image: new RegularShape({
                    fill: new Fill({ color: cfg.fillColor }),
                    stroke: new Stroke({ color: cfg.color, width: 1 }),
                    points: 4,
                    radius: cfg.size,
                    radius2: 0,
                    angle: Math.PI / 4,
                }),
            });
        },
    },
];
export var markerMakers = new Registry(function () { return makers; });
export var getMarkerFromPath = function (svgPath) {
    var e_1, _a;
    try {
        for (var _b = __values(Object.entries(MarkerShapePath)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), key = _d[0], val = _d[1];
            if (val === svgPath) {
                return markerMakers.getIfExists(key);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return undefined;
};
//# sourceMappingURL=regularShapes.js.map