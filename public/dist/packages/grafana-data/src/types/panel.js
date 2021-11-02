import { __values } from "tslib";
import { FieldType } from './dataFrame';
import { defaultsDeep } from 'lodash';
export var VizOrientation;
(function (VizOrientation) {
    VizOrientation["Auto"] = "auto";
    VizOrientation["Vertical"] = "vertical";
    VizOrientation["Horizontal"] = "horizontal";
})(VizOrientation || (VizOrientation = {}));
/**
 * @alpha
 */
var VisualizationSuggestionsBuilder = /** @class */ (function () {
    function VisualizationSuggestionsBuilder(data, panel) {
        this.list = [];
        this.data = data;
        this.panel = panel;
        this.dataSummary = this.computeDataSummary();
    }
    VisualizationSuggestionsBuilder.prototype.getListAppender = function (defaults) {
        return new VisualizationSuggestionsListAppender(this.list, defaults);
    };
    VisualizationSuggestionsBuilder.prototype.computeDataSummary = function () {
        var e_1, _a, e_2, _b;
        var _c;
        var frames = ((_c = this.data) === null || _c === void 0 ? void 0 : _c.series) || [];
        var numberFieldCount = 0;
        var timeFieldCount = 0;
        var stringFieldCount = 0;
        var rowCountTotal = 0;
        var rowCountMax = 0;
        try {
            for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
                var frame = frames_1_1.value;
                rowCountTotal += frame.length;
                try {
                    for (var _d = (e_2 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var field = _e.value;
                        switch (field.type) {
                            case FieldType.number:
                                numberFieldCount += 1;
                                break;
                            case FieldType.time:
                                timeFieldCount += 1;
                                break;
                            case FieldType.string:
                                stringFieldCount += 1;
                                break;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                if (frame.length > rowCountMax) {
                    rowCountMax = frame.length;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (frames_1_1 && !frames_1_1.done && (_a = frames_1.return)) _a.call(frames_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return {
            numberFieldCount: numberFieldCount,
            timeFieldCount: timeFieldCount,
            stringFieldCount: stringFieldCount,
            rowCountTotal: rowCountTotal,
            rowCountMax: rowCountMax,
            frameCount: frames.length,
            hasData: rowCountTotal > 0,
            hasTimeField: timeFieldCount > 0,
            hasNumberField: numberFieldCount > 0,
            hasStringField: stringFieldCount > 0,
        };
    };
    VisualizationSuggestionsBuilder.prototype.getList = function () {
        return this.list;
    };
    return VisualizationSuggestionsBuilder;
}());
export { VisualizationSuggestionsBuilder };
/**
 * Helps with typings and defaults
 * @alpha
 */
var VisualizationSuggestionsListAppender = /** @class */ (function () {
    function VisualizationSuggestionsListAppender(list, defaults) {
        this.list = list;
        this.defaults = defaults;
    }
    VisualizationSuggestionsListAppender.prototype.append = function (overrides) {
        this.list.push(defaultsDeep(overrides, this.defaults));
    };
    return VisualizationSuggestionsListAppender;
}());
export { VisualizationSuggestionsListAppender };
//# sourceMappingURL=panel.js.map