import { __assign, __awaiter, __generator, __makeTemplateObject } from "tslib";
// Libraries
import React from 'react';
import { css } from '@emotion/css';
import { components } from 'react-select';
import debounce from 'debounce-promise';
import { stylesFactory, useTheme, resetSelectStyles, Icon, AsyncMultiSelect } from '@grafana/ui';
import { escapeStringForRegex } from '@grafana/data';
// Components
import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';
var filterOption = function (option, searchQuery) {
    var regex = RegExp(escapeStringForRegex(searchQuery), 'i');
    return regex.test(option.value);
};
export var TagFilter = function (_a) {
    var _b = _a.allowCustomValue, allowCustomValue = _b === void 0 ? false : _b, formatCreateLabel = _a.formatCreateLabel, hideValues = _a.hideValues, inputId = _a.inputId, isClearable = _a.isClearable, onChange = _a.onChange, _c = _a.placeholder, placeholder = _c === void 0 ? 'Filter by tag' : _c, tagOptions = _a.tagOptions, tags = _a.tags, width = _a.width;
    var theme = useTheme();
    var styles = getStyles(theme);
    var onLoadOptions = function (query) { return __awaiter(void 0, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tagOptions()];
                case 1:
                    options = _a.sent();
                    return [2 /*return*/, options.map(function (option) { return ({
                            value: option.term,
                            label: option.term,
                            count: option.count,
                        }); })];
            }
        });
    }); };
    var debouncedLoadOptions = debounce(onLoadOptions, 300);
    var onTagChange = function (newTags) {
        // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
        // https://github.com/JedWatson/react-select/issues/3632
        onChange((newTags || []).map(function (tag) { return tag.value; }));
    };
    var value = tags.map(function (tag) { return ({ value: tag, label: tag, count: 0 }); });
    var selectOptions = {
        allowCreateWhileLoading: true,
        allowCustomValue: allowCustomValue,
        formatCreateLabel: formatCreateLabel,
        defaultOptions: true,
        filterOption: filterOption,
        getOptionLabel: function (i) { return i.label; },
        getOptionValue: function (i) { return i.value; },
        inputId: inputId,
        isMulti: true,
        loadOptions: debouncedLoadOptions,
        loadingMessage: 'Loading...',
        noOptionsMessage: 'No tags found',
        onChange: onTagChange,
        placeholder: placeholder,
        styles: resetSelectStyles(),
        value: value,
        width: width,
        components: {
            Option: TagOption,
            MultiValueLabel: function () {
                return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
            },
            MultiValueRemove: function (props) {
                var data = props.data;
                return (React.createElement(components.MultiValueRemove, __assign({}, props),
                    React.createElement(TagBadge, { key: data.label, label: data.label, removeIcon: true, count: data.count })));
            },
            MultiValueContainer: hideValues ? function () { return null; } : components.MultiValueContainer,
        },
    };
    return (React.createElement("div", { className: styles.tagFilter },
        isClearable && tags.length > 0 && (React.createElement("span", { className: styles.clear, onClick: function () { return onTagChange([]); } }, "Clear tags")),
        React.createElement(AsyncMultiSelect, __assign({ menuShouldPortal: true }, selectOptions, { prefix: React.createElement(Icon, { name: "tag-alt" }), "aria-label": "Tag filter" }))));
};
TagFilter.displayName = 'TagFilter';
var getStyles = stylesFactory(function (theme) {
    return {
        tagFilter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n\n      .label-tag {\n        margin-left: 6px;\n        cursor: pointer;\n      }\n    "], ["\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n\n      .label-tag {\n        margin-left: 6px;\n        cursor: pointer;\n      }\n    "]))),
        clear: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-decoration: underline;\n      font-size: 12px;\n      position: absolute;\n      top: -22px;\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      text-decoration: underline;\n      font-size: 12px;\n      position: absolute;\n      top: -22px;\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.colors.textStrong),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=TagFilter.js.map