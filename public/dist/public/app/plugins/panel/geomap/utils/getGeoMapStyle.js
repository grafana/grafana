import { Style, Stroke, Fill } from 'ol/style';
/**
 * Gets a geomap style based on fill, stroke, and stroke width
 * @returns ol style
 */
export var getGeoMapStyle = function (config, property) {
    var _a, _b;
    return new Style({
        fill: new Fill({
            color: "" + ((_a = config.fillColor) !== null && _a !== void 0 ? _a : '#1F60C4'),
        }),
        stroke: (config === null || config === void 0 ? void 0 : config.strokeWidth)
            ? new Stroke({
                color: "" + ((_b = config.fillColor) !== null && _b !== void 0 ? _b : '#1F60C4'),
                width: config.strokeWidth,
            })
            : undefined,
        //handle a shape/marker too?
    });
};
//# sourceMappingURL=getGeoMapStyle.js.map