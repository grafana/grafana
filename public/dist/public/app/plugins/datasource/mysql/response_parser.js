import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import { toDataQueryResponse } from '@grafana/runtime';
var ResponseParser = /** @class */ (function () {
    function ResponseParser() {
    }
    ResponseParser.prototype.transformMetricFindResponse = function (raw) {
        var frames = toDataQueryResponse(raw).data;
        if (!frames || !frames.length) {
            return [];
        }
        var frame = frames[0];
        var values = [];
        var textField = frame.fields.find(function (f) { return f.name === '__text'; });
        var valueField = frame.fields.find(function (f) { return f.name === '__value'; });
        if (textField && valueField) {
            for (var i = 0; i < textField.values.length; i++) {
                values.push({ text: '' + textField.values.get(i), value: '' + valueField.values.get(i) });
            }
        }
        else {
            values.push.apply(values, __spreadArray([], __read(frame.fields
                .flatMap(function (f) { return f.values.toArray(); })
                .map(function (v) { return ({
                text: v,
            }); })), false));
        }
        return Array.from(new Set(values.map(function (v) { return v.text; }))).map(function (text) {
            var _a;
            return ({
                text: text,
                value: (_a = values.find(function (v) { return v.text === text; })) === null || _a === void 0 ? void 0 : _a.value,
            });
        });
    };
    ResponseParser.prototype.transformAnnotationResponse = function (options, data) {
        return __awaiter(this, void 0, void 0, function () {
            var frames, frame, timeField, timeEndField, textField, tagsField, list, i, timeEnd;
            return __generator(this, function (_a) {
                frames = toDataQueryResponse({ data: data }).data;
                if (!frames || !frames.length) {
                    return [2 /*return*/, []];
                }
                frame = frames[0];
                timeField = frame.fields.find(function (f) { return f.name === 'time' || f.name === 'time_sec'; });
                if (!timeField) {
                    throw new Error('Missing mandatory time column (with time column alias) in annotation query');
                }
                if (frame.fields.find(function (f) { return f.name === 'title'; })) {
                    throw new Error('The title column for annotations is deprecated, now only a column named text is returned');
                }
                timeEndField = frame.fields.find(function (f) { return f.name === 'timeend'; });
                textField = frame.fields.find(function (f) { return f.name === 'text'; });
                tagsField = frame.fields.find(function (f) { return f.name === 'tags'; });
                list = [];
                for (i = 0; i < frame.length; i++) {
                    timeEnd = timeEndField && timeEndField.values.get(i) ? Math.floor(timeEndField.values.get(i)) : undefined;
                    list.push({
                        annotation: options.annotation,
                        time: Math.floor(timeField.values.get(i)),
                        timeEnd: timeEnd,
                        text: textField && textField.values.get(i) ? textField.values.get(i) : '',
                        tags: tagsField && tagsField.values.get(i)
                            ? tagsField.values
                                .get(i)
                                .trim()
                                .split(/\s*,\s*/)
                            : [],
                    });
                }
                return [2 /*return*/, list];
            });
        });
    };
    return ResponseParser;
}());
export default ResponseParser;
//# sourceMappingURL=response_parser.js.map