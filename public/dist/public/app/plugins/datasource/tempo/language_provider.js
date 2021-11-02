import { __awaiter, __extends, __generator } from "tslib";
import { LanguageProvider } from '@grafana/data';
var TempoLanguageProvider = /** @class */ (function (_super) {
    __extends(TempoLanguageProvider, _super);
    function TempoLanguageProvider(datasource, initialValues) {
        var _this = _super.call(this) || this;
        _this.request = function (url, params) {
            if (params === void 0) { params = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var res;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.datasource.metadataRequest(url, params)];
                        case 1:
                            res = _a.sent();
                            return [2 /*return*/, res === null || res === void 0 ? void 0 : res.data];
                    }
                });
            });
        };
        _this.start = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchTags()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, []];
                }
            });
        }); };
        _this.provideCompletionItems = function (_a, context) {
            var prefix = _a.prefix, text = _a.text, value = _a.value, labelKey = _a.labelKey, wrapperClasses = _a.wrapperClasses;
            if (context === void 0) { context = { history: [] }; }
            return __awaiter(_this, void 0, void 0, function () {
                var emptyResult;
                return __generator(this, function (_b) {
                    emptyResult = { suggestions: [] };
                    if (!value) {
                        return [2 /*return*/, emptyResult];
                    }
                    if (text === '=') {
                        return [2 /*return*/, this.getTagValueCompletionItems(value)];
                    }
                    return [2 /*return*/, this.getTagsCompletionItems()];
                });
            });
        };
        _this.getTagsCompletionItems = function () {
            var tags = _this.tags;
            var suggestions = [];
            if (tags === null || tags === void 0 ? void 0 : tags.length) {
                suggestions.push({
                    label: "Tag",
                    items: tags.map(function (tag) { return ({ label: tag }); }),
                });
            }
            return { suggestions: suggestions };
        };
        _this.datasource = datasource;
        Object.assign(_this, initialValues);
        return _this;
    }
    TempoLanguageProvider.prototype.fetchTags = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request('/api/search/tags', [])];
                    case 1:
                        response = _a.sent();
                        this.tags = response.tagNames;
                        return [2 /*return*/];
                }
            });
        });
    };
    TempoLanguageProvider.prototype.getTagValueCompletionItems = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var tagNames, tagName, response, suggestions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tagNames = value.endText.getText().split(' ');
                        tagName = tagNames[0];
                        // Get last item if multiple tags
                        if (tagNames.length > 1) {
                            tagName = tagNames[tagNames.length - 1];
                        }
                        tagName = tagName.slice(0, -1);
                        return [4 /*yield*/, this.request("/api/search/tag/" + tagName + "/values", [])];
                    case 1:
                        response = _a.sent();
                        suggestions = [];
                        if (response && response.tagValues) {
                            suggestions.push({
                                label: "TagValues",
                                items: response.tagValues.map(function (tagValue) { return ({ label: tagValue }); }),
                            });
                        }
                        return [2 /*return*/, { suggestions: suggestions }];
                }
            });
        });
    };
    TempoLanguageProvider.prototype.getOptions = function (tag) {
        return __awaiter(this, void 0, void 0, function () {
            var response, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/api/search/tag/" + tag + "/values")];
                    case 1:
                        response = _a.sent();
                        options = [];
                        if (response && response.tagValues) {
                            options = response.tagValues.map(function (v) { return ({
                                value: v,
                                label: v,
                            }); });
                        }
                        return [2 /*return*/, options];
                }
            });
        });
    };
    return TempoLanguageProvider;
}(LanguageProvider));
export default TempoLanguageProvider;
//# sourceMappingURL=language_provider.js.map