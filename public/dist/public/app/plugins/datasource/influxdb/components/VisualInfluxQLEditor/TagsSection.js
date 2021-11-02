import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { Seg } from './Seg';
import { toSelectableValue } from './toSelectableValue';
import { adjustOperatorIfNeeded, getCondition, getOperator } from './tagUtils';
import { AddButton } from './AddButton';
var knownOperators = ['=', '!=', '<>', '<', '>', '=~', '!~'];
var knownConditions = ['AND', 'OR'];
var operatorOptions = knownOperators.map(toSelectableValue);
var condititonOptions = knownConditions.map(toSelectableValue);
var loadConditionOptions = function () { return Promise.resolve(condititonOptions); };
var loadOperatorOptions = function () { return Promise.resolve(operatorOptions); };
var Tag = function (_a) {
    var tag = _a.tag, isFirst = _a.isFirst, onRemove = _a.onRemove, onChange = _a.onChange, getTagKeyOptions = _a.getTagKeyOptions, getTagValueOptions = _a.getTagValueOptions;
    var operator = getOperator(tag);
    var condition = getCondition(tag, isFirst);
    var getTagKeySegmentOptions = function () {
        return getTagKeyOptions().then(function (tags) { return __spreadArray([
            { label: '-- remove filter --', value: undefined }
        ], __read(tags.map(toSelectableValue)), false); });
    };
    var getTagValueSegmentOptions = function () {
        return getTagValueOptions(tag.key).then(function (tags) { return tags.map(toSelectableValue); });
    };
    return (React.createElement("div", { className: "gf-form" },
        condition != null && (React.createElement(Seg, { value: condition, loadOptions: loadConditionOptions, onChange: function (v) {
                onChange(__assign(__assign({}, tag), { condition: v.value }));
            } })),
        React.createElement(Seg, { allowCustomValue: true, value: tag.key, loadOptions: getTagKeySegmentOptions, onChange: function (v) {
                var value = v.value;
                if (value === undefined) {
                    onRemove();
                }
                else {
                    onChange(__assign(__assign({}, tag), { key: value !== null && value !== void 0 ? value : '' }));
                }
            } }),
        React.createElement(Seg, { value: operator, loadOptions: loadOperatorOptions, onChange: function (op) {
                onChange(__assign(__assign({}, tag), { operator: op.value }));
            } }),
        React.createElement(Seg, { allowCustomValue: true, value: tag.value, loadOptions: getTagValueSegmentOptions, onChange: function (v) {
                var _a;
                var value = (_a = v.value) !== null && _a !== void 0 ? _a : '';
                onChange(__assign(__assign({}, tag), { value: value, operator: adjustOperatorIfNeeded(operator, value) }));
            } })));
};
export var TagsSection = function (_a) {
    var tags = _a.tags, onChange = _a.onChange, getTagKeyOptions = _a.getTagKeyOptions, getTagValueOptions = _a.getTagValueOptions;
    var onTagChange = function (newTag, index) {
        var newTags = tags.map(function (tag, i) {
            return index === i ? newTag : tag;
        });
        onChange(newTags);
    };
    var onTagRemove = function (index) {
        var newTags = tags.filter(function (t, i) { return i !== index; });
        onChange(newTags);
    };
    var getTagKeySegmentOptions = function () {
        return getTagKeyOptions().then(function (tags) { return tags.map(toSelectableValue); });
    };
    var addNewTag = function (tagKey, isFirst) {
        var minimalTag = {
            key: tagKey,
            value: 'select tag value',
        };
        var newTag = {
            key: minimalTag.key,
            value: minimalTag.value,
            operator: getOperator(minimalTag),
            condition: getCondition(minimalTag, isFirst),
        };
        onChange(__spreadArray(__spreadArray([], __read(tags), false), [newTag], false));
    };
    return (React.createElement(React.Fragment, null,
        tags.map(function (t, i) { return (React.createElement(Tag, { tag: t, isFirst: i === 0, key: i, onChange: function (newT) {
                onTagChange(newT, i);
            }, onRemove: function () {
                onTagRemove(i);
            }, getTagKeyOptions: getTagKeyOptions, getTagValueOptions: getTagValueOptions })); }),
        React.createElement(AddButton, { allowCustomValue: true, loadOptions: getTagKeySegmentOptions, onAdd: function (v) {
                addNewTag(v, tags.length === 0);
            } })));
};
//# sourceMappingURL=TagsSection.js.map