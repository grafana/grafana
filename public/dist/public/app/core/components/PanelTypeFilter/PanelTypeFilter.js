import { __assign, __makeTemplateObject, __read, __values } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { Icon, resetSelectStyles, MultiSelect, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
export var PanelTypeFilter = function (_a) {
    var propsOnChange = _a.onChange, maxMenuHeight = _a.maxMenuHeight;
    var plugins = useMemo(function () {
        return getAllPanelPluginMeta();
    }, []);
    var options = useMemo(function () {
        return plugins
            .map(function (p) { return ({ label: p.name, imgUrl: p.info.logos.small, value: p }); })
            .sort(function (a, b) { var _a; return (_a = a.label) === null || _a === void 0 ? void 0 : _a.localeCompare(b.label); });
    }, [plugins]);
    var _b = __read(useState([]), 2), value = _b[0], setValue = _b[1];
    var onChange = useCallback(function (plugins) {
        var e_1, _a;
        var changedPlugins = [];
        try {
            for (var plugins_1 = __values(plugins), plugins_1_1 = plugins_1.next(); !plugins_1_1.done; plugins_1_1 = plugins_1.next()) {
                var plugin = plugins_1_1.value;
                if (plugin.value) {
                    changedPlugins.push(plugin.value);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (plugins_1_1 && !plugins_1_1.done && (_a = plugins_1.return)) _a.call(plugins_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        propsOnChange(changedPlugins);
        setValue(plugins);
    }, [propsOnChange]);
    var styles = useStyles2(getStyles);
    var selectOptions = {
        defaultOptions: true,
        getOptionLabel: function (i) { return i.label; },
        getOptionValue: function (i) { return i.value; },
        noOptionsMessage: 'No Panel types found',
        placeholder: 'Filter by type',
        styles: resetSelectStyles(),
        maxMenuHeight: maxMenuHeight,
        options: options,
        value: value,
        onChange: onChange,
    };
    return (React.createElement("div", { className: styles.container },
        value.length > 0 && (React.createElement("span", { className: styles.clear, onClick: function () { return onChange([]); } }, "Clear types")),
        React.createElement(MultiSelect, __assign({ menuShouldPortal: true }, selectOptions, { prefix: React.createElement(Icon, { name: "filter" }), "aria-label": "Panel Type filter" }))));
};
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: container;\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n    "], ["\n      label: container;\n      position: relative;\n      min-width: 180px;\n      flex-grow: 1;\n    "]))),
        clear: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: clear;\n      text-decoration: underline;\n      font-size: ", ";\n      position: absolute;\n      top: -", ";\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      label: clear;\n      text-decoration: underline;\n      font-size: ", ";\n      position: absolute;\n      top: -", ";\n      right: 0;\n      cursor: pointer;\n      color: ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.spacing(1.5), theme.spacing(2.75), theme.colors.text.link, theme.colors.text.maxContrast),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=PanelTypeFilter.js.map