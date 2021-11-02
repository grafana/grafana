import { VisibilityMode, AxisPlacement, } from '@grafana/schema';
export var ScatterLineMode;
(function (ScatterLineMode) {
    ScatterLineMode["None"] = "none";
    ScatterLineMode["Linear"] = "linear";
    // Smooth
    // r2, etc
})(ScatterLineMode || (ScatterLineMode = {}));
export var defaultScatterConfig = {
    line: ScatterLineMode.None,
    lineWidth: 1,
    lineStyle: {
        fill: 'solid',
    },
    point: VisibilityMode.Auto,
    pointSize: {
        fixed: 5,
        min: 1,
        max: 20,
    },
    axisPlacement: AxisPlacement.Auto,
};
//# sourceMappingURL=models.gen.js.map