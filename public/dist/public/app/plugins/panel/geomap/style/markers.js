import { __awaiter } from "tslib";
import { Fill, RegularShape, Stroke, Circle, Style, Icon, Text } from 'ol/style';
import tinycolor from 'tinycolor2';
import { Registry, textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';
import { defaultStyleConfig, DEFAULT_SIZE } from './types';
import { getDisplacement } from './utils';
var RegularShapeId;
(function (RegularShapeId) {
    RegularShapeId["circle"] = "circle";
    RegularShapeId["square"] = "square";
    RegularShapeId["triangle"] = "triangle";
    RegularShapeId["star"] = "star";
    RegularShapeId["cross"] = "cross";
    RegularShapeId["x"] = "x";
})(RegularShapeId || (RegularShapeId = {}));
const MarkerShapePath = {
    circle: 'img/icons/marker/circle.svg',
    square: 'img/icons/marker/square.svg',
    triangle: 'img/icons/marker/triangle.svg',
    star: 'img/icons/marker/star.svg',
    cross: 'img/icons/marker/cross.svg',
    x: 'img/icons/marker/x-mark.svg',
};
export function getFillColor(cfg) {
    const opacity = cfg.opacity == null ? 0.8 : cfg.opacity;
    if (opacity === 1) {
        return new Fill({ color: cfg.color });
    }
    if (opacity > 0) {
        const color = tinycolor(cfg.color).setAlpha(opacity).toRgbString();
        return new Fill({ color });
    }
    return undefined;
}
export function getStrokeStyle(cfg) {
    var _a, _b;
    const opacity = cfg.opacity == null ? 0.8 : cfg.opacity;
    if (opacity === 1) {
        return new Stroke({ color: cfg.color, width: (_a = cfg.lineWidth) !== null && _a !== void 0 ? _a : 1 });
    }
    if (opacity > 0) {
        const color = tinycolor(cfg.color).setAlpha(opacity).toRgbString();
        return new Stroke({ color, width: (_b = cfg.lineWidth) !== null && _b !== void 0 ? _b : 1 });
    }
    return undefined;
}
const textLabel = (cfg) => {
    var _a;
    if (!cfg.text) {
        return undefined;
    }
    const fontFamily = config.theme2.typography.fontFamily;
    const textConfig = Object.assign(Object.assign({}, defaultStyleConfig.textConfig), cfg.textConfig);
    return new Text(Object.assign({ text: cfg.text, fill: new Fill({ color: (_a = cfg.color) !== null && _a !== void 0 ? _a : defaultStyleConfig.color.fixed }), font: `normal ${textConfig.fontSize}px ${fontFamily}` }, textConfig));
};
export const textMarker = (cfg) => {
    return new Style({
        text: textLabel(cfg),
    });
};
export const circleMarker = (cfg) => {
    var _a, _b, _c;
    const stroke = new Stroke({ color: cfg.color, width: (_a = cfg.lineWidth) !== null && _a !== void 0 ? _a : 1 });
    const radius = (_b = cfg.size) !== null && _b !== void 0 ? _b : DEFAULT_SIZE;
    return new Style({
        image: new Circle({
            stroke,
            fill: getFillColor(cfg),
            radius,
            displacement: getDisplacement((_c = cfg.symbolAlign) !== null && _c !== void 0 ? _c : defaultStyleConfig.symbolAlign, radius),
        }),
        text: textLabel(cfg),
        stroke, // in case lines are sent to the markers layer
    });
};
// Does not have image
export const polyStyle = (cfg) => {
    var _a;
    return new Style({
        fill: getFillColor(cfg),
        stroke: new Stroke({ color: cfg.color, width: (_a = cfg.lineWidth) !== null && _a !== void 0 ? _a : 1 }),
        text: textLabel(cfg),
    });
};
export const routeStyle = (cfg) => {
    return new Style({
        fill: getFillColor(cfg),
        stroke: getStrokeStyle(cfg),
        text: textLabel(cfg),
    });
};
// Square and cross
const errorMarker = (cfg) => {
    var _a;
    const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
    const stroke = new Stroke({ color: '#F00', width: 1 });
    return [
        new Style({
            image: new RegularShape({
                stroke,
                points: 4,
                radius,
                angle: Math.PI / 4,
            }),
        }),
        new Style({
            image: new RegularShape({
                stroke,
                points: 4,
                radius,
                radius2: 0,
                angle: 0,
            }),
        }),
    ];
};
const makers = [
    {
        id: RegularShapeId.circle,
        name: 'Circle',
        aliasIds: [MarkerShapePath.circle],
        make: circleMarker,
    },
    {
        id: RegularShapeId.square,
        name: 'Square',
        aliasIds: [MarkerShapePath.square],
        make: (cfg) => {
            var _a, _b, _c, _d;
            const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
            const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({ color: cfg.color, width: (_c = cfg.lineWidth) !== null && _c !== void 0 ? _c : 1 }),
                    fill: getFillColor(cfg),
                    points: 4,
                    radius,
                    angle: Math.PI / 4,
                    rotation: (rotation * Math.PI) / 180,
                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius),
                }),
                text: textLabel(cfg),
            });
        },
    },
    {
        id: RegularShapeId.triangle,
        name: 'Triangle',
        aliasIds: [MarkerShapePath.triangle],
        make: (cfg) => {
            var _a, _b, _c, _d;
            const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
            const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({ color: cfg.color, width: (_c = cfg.lineWidth) !== null && _c !== void 0 ? _c : 1 }),
                    fill: getFillColor(cfg),
                    points: 3,
                    radius,
                    rotation: (rotation * Math.PI) / 180,
                    angle: 0,
                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius),
                }),
                text: textLabel(cfg),
            });
        },
    },
    {
        id: RegularShapeId.star,
        name: 'Star',
        aliasIds: [MarkerShapePath.star],
        make: (cfg) => {
            var _a, _b, _c, _d;
            const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
            const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({ color: cfg.color, width: (_c = cfg.lineWidth) !== null && _c !== void 0 ? _c : 1 }),
                    fill: getFillColor(cfg),
                    points: 5,
                    radius,
                    radius2: radius * 0.4,
                    angle: 0,
                    rotation: (rotation * Math.PI) / 180,
                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius),
                }),
                text: textLabel(cfg),
            });
        },
    },
    {
        id: RegularShapeId.cross,
        name: 'Cross',
        aliasIds: [MarkerShapePath.cross],
        make: (cfg) => {
            var _a, _b, _c, _d;
            const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
            const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({ color: cfg.color, width: (_c = cfg.lineWidth) !== null && _c !== void 0 ? _c : 1 }),
                    points: 4,
                    radius,
                    radius2: 0,
                    angle: 0,
                    rotation: (rotation * Math.PI) / 180,
                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius),
                }),
                text: textLabel(cfg),
            });
        },
    },
    {
        id: RegularShapeId.x,
        name: 'X',
        aliasIds: [MarkerShapePath.x],
        make: (cfg) => {
            var _a, _b, _c, _d;
            const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
            const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
            return new Style({
                image: new RegularShape({
                    stroke: new Stroke({ color: cfg.color, width: (_c = cfg.lineWidth) !== null && _c !== void 0 ? _c : 1 }),
                    points: 4,
                    radius,
                    radius2: 0,
                    angle: Math.PI / 4,
                    rotation: (rotation * Math.PI) / 180,
                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius),
                }),
                text: textLabel(cfg),
            });
        },
    },
];
function prepareSVG(url, size) {
    return __awaiter(this, void 0, void 0, function* () {
        return fetch(url, { method: 'GET' })
            .then((res) => {
            return res.text();
        })
            .then((text) => {
            var _a, _b;
            text = textUtil.sanitizeSVGContent(text);
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svg = doc.getElementsByTagName('svg')[0];
            if (!svg) {
                return '';
            }
            const svgSize = size !== null && size !== void 0 ? size : 100;
            const width = (_a = svg.getAttribute('width')) !== null && _a !== void 0 ? _a : svgSize;
            const height = (_b = svg.getAttribute('height')) !== null && _b !== void 0 ? _b : svgSize;
            // open layers requires a white fill becaues it uses tint to set color
            svg.setAttribute('fill', '#fff');
            svg.setAttribute('width', `${width}px`);
            svg.setAttribute('height', `${height}px`);
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgURI = encodeURIComponent(svgString);
            return `data:image/svg+xml,${svgURI}`;
        })
            .catch((error) => {
            console.error(error); // eslint-disable-line no-console
            return '';
        });
    });
}
// Really just a cache for the various symbol styles
const markerMakers = new Registry(() => makers);
export function getMarkerAsPath(shape) {
    var _a;
    const marker = markerMakers.getIfExists(shape);
    if ((_a = marker === null || marker === void 0 ? void 0 : marker.aliasIds) === null || _a === void 0 ? void 0 : _a.length) {
        return marker.aliasIds[0];
    }
    return undefined;
}
// Will prepare symbols as necessary
export function getMarkerMaker(symbol, hasTextLabel) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!symbol) {
            return hasTextLabel ? textMarker : circleMarker;
        }
        let maker = markerMakers.getIfExists(symbol);
        if (maker) {
            return maker.make;
        }
        // Prepare svg as icon
        if (symbol.endsWith('.svg')) {
            const src = yield prepareSVG(getPublicOrAbsoluteUrl(symbol));
            maker = {
                id: symbol,
                name: symbol,
                aliasIds: [],
                make: src
                    ? (cfg) => {
                        var _a, _b, _c, _d;
                        const radius = (_a = cfg.size) !== null && _a !== void 0 ? _a : DEFAULT_SIZE;
                        const rotation = (_b = cfg.rotation) !== null && _b !== void 0 ? _b : 0;
                        return [
                            new Style({
                                image: new Icon({
                                    src,
                                    color: cfg.color,
                                    opacity: (_c = cfg.opacity) !== null && _c !== void 0 ? _c : 1,
                                    scale: (DEFAULT_SIZE + radius) / 100,
                                    rotation: (rotation * Math.PI) / 180,
                                    displacement: getDisplacement((_d = cfg.symbolAlign) !== null && _d !== void 0 ? _d : defaultStyleConfig.symbolAlign, radius / 2),
                                }),
                                text: !(cfg === null || cfg === void 0 ? void 0 : cfg.text) ? undefined : textLabel(cfg),
                            }),
                            // transparent bounding box for featureAtPixel detection
                            new Style({
                                image: new RegularShape({
                                    fill: new Fill({ color: 'rgba(0,0,0,0)' }),
                                    points: 4,
                                    radius: cfg.size,
                                    rotation: (rotation * Math.PI) / 180 + Math.PI / 4,
                                }),
                            }),
                        ];
                    }
                    : errorMarker,
            };
            markerMakers.register(maker);
            return maker.make;
        }
        // default to showing a circle
        return errorMarker;
    });
}
//# sourceMappingURL=markers.js.map