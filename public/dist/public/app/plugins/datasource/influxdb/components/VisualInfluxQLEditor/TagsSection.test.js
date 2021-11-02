import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import React from 'react';
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import { TagsSection } from './TagsSection';
function getTagKeys() {
    return Promise.resolve(['t1', 't2', 't3', 't4', 't5', 't6']);
}
function getTagValuesForKey(key) {
    var data = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map(function (v) { return key + "_" + v; });
    return Promise.resolve(data);
}
function assertText(tags, textResult) {
    var container = render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: function () { return null; } })).container;
    expect(container.textContent).toBe(textResult);
}
function assertSegmentSelect(segmentText, optionText, callback, callbackValue) {
    return __awaiter(this, void 0, void 0, function () {
        var segs, seg, option;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    segs = screen.getAllByRole('button', { name: segmentText });
                    expect(segs.length).toBe(1);
                    seg = segs[0];
                    expect(seg).toBeInTheDocument();
                    act(function () {
                        fireEvent.click(seg);
                    });
                    return [4 /*yield*/, screen.findByText(optionText, { selector: 'span' })];
                case 1:
                    option = _a.sent();
                    expect(option).toBeInTheDocument();
                    act(function () {
                        fireEvent.click(option);
                    });
                    return [4 /*yield*/, waitFor(function () { return expect(callback).toHaveBeenCalledTimes(1); })];
                case 2:
                    _a.sent();
                    expect(callback).toHaveBeenCalledWith(callbackValue);
                    return [2 /*return*/];
            }
        });
    });
}
var tags = [
    {
        key: 't1',
        value: 't1_v1',
        operator: '=',
    },
    {
        condition: 'AND',
        key: 't2',
        value: 't2_v2',
        operator: '!=',
    },
    {
        condition: 'OR',
        key: 't3',
        value: 't3_v3',
        operator: '<>',
    },
];
describe('InfluxDB InfluxQL Editor tags section', function () {
    it('should display correct data', function () {
        assertText(tags, 't1=t1_v1ANDt2!=t2_v2ORt3<>t3_v3+');
    });
    it('should handle incorrect data', function () {
        var incorrectTags = [
            {
                condition: 'OR',
                key: 't1',
                value: 't1_v1',
                operator: '=',
            },
            {
                // missing `condition`
                key: 't2',
                value: 't2_v2',
                operator: '!=',
            },
            {
                condition: 'OR',
                key: 't3',
                value: 't3_v3',
                // missing `operator, string-value
            },
            {
                condition: 'OR',
                key: 't4',
                value: '/t4_v4/',
                // missing `operator, regex-value
            },
            {
                condition: 'XOR',
                key: 't5',
                value: 't5_v5',
                operator: 'haha', // invalid `operator`
            },
        ];
        assertText(incorrectTags, 't1=t1_v1ANDt2!=t2_v2ORt3=t3_v3ORt4=~/t4_v4/XORt5hahat5_v5+');
    });
    it('should handle adding a new tag check', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
                    return [4 /*yield*/, assertSegmentSelect('+', 't5', onChange, __spreadArray(__spreadArray([], __read(tags), false), [
                            {
                                key: 't5',
                                value: 'select tag value',
                                operator: '=',
                                condition: 'AND',
                            },
                        ], false))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle changing the tag-condition', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, newTags;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
                    newTags = __spreadArray([], __read(tags), false);
                    newTags[1] = __assign(__assign({}, newTags[1]), { condition: 'OR' });
                    return [4 /*yield*/, assertSegmentSelect('AND', 'OR', onChange, newTags)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle changing the tag-key', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, newTags;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
                    newTags = __spreadArray([], __read(tags), false);
                    newTags[1] = __assign(__assign({}, newTags[1]), { key: 't5' });
                    return [4 /*yield*/, assertSegmentSelect('t2', 't5', onChange, newTags)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle changing the tag-operator', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, newTags;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
                    newTags = __spreadArray([], __read(tags), false);
                    newTags[2] = __assign(__assign({}, newTags[2]), { operator: '<' });
                    return [4 /*yield*/, assertSegmentSelect('<>', '<', onChange, newTags)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle changing the tag-value', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, newTags;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(TagsSection, { tags: tags, getTagKeyOptions: getTagKeys, getTagValueOptions: getTagValuesForKey, onChange: onChange }));
                    newTags = __spreadArray([], __read(tags), false);
                    newTags[0] = __assign(__assign({}, newTags[0]), { value: 't1_v5' });
                    return [4 /*yield*/, assertSegmentSelect('t1_v1', 't1_v5', onChange, newTags)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=TagsSection.test.js.map