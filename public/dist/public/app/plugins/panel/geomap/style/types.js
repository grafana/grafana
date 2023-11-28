import { ResourceDimensionMode, ScalarDimensionMode, } from '@grafana/schema';
export var GeometryTypeId;
(function (GeometryTypeId) {
    GeometryTypeId["Point"] = "point";
    GeometryTypeId["Line"] = "line";
    GeometryTypeId["Polygon"] = "polygon";
    GeometryTypeId["Any"] = "*any*";
})(GeometryTypeId || (GeometryTypeId = {}));
export const DEFAULT_SIZE = 5;
export var TextAlignment;
(function (TextAlignment) {
    TextAlignment["Left"] = "left";
    TextAlignment["Center"] = "center";
    TextAlignment["Right"] = "right";
})(TextAlignment || (TextAlignment = {}));
export var TextBaseline;
(function (TextBaseline) {
    TextBaseline["Top"] = "top";
    TextBaseline["Middle"] = "middle";
    TextBaseline["Bottom"] = "bottom";
})(TextBaseline || (TextBaseline = {}));
export var HorizontalAlign;
(function (HorizontalAlign) {
    HorizontalAlign["Left"] = "left";
    HorizontalAlign["Center"] = "center";
    HorizontalAlign["Right"] = "right";
})(HorizontalAlign || (HorizontalAlign = {}));
export var VerticalAlign;
(function (VerticalAlign) {
    VerticalAlign["Top"] = "top";
    VerticalAlign["Center"] = "center";
    VerticalAlign["Bottom"] = "bottom";
})(VerticalAlign || (VerticalAlign = {}));
export const defaultStyleConfig = Object.freeze({
    size: {
        fixed: DEFAULT_SIZE,
        min: 2,
        max: 15,
    },
    color: {
        fixed: 'dark-green', // picked from theme
    },
    opacity: 0.4,
    symbol: {
        mode: ResourceDimensionMode.Fixed,
        fixed: 'img/icons/marker/circle.svg',
    },
    symbolAlign: {
        horizontal: HorizontalAlign.Center,
        vertical: VerticalAlign.Center,
    },
    textConfig: {
        fontSize: 12,
        textAlign: TextAlignment.Center,
        textBaseline: TextBaseline.Middle,
        offsetX: 0,
        offsetY: 0,
    },
    rotation: {
        fixed: 0,
        mode: ScalarDimensionMode.Mod,
        min: -360,
        max: 360,
    },
});
//# sourceMappingURL=types.js.map