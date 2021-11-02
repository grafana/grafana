import { __awaiter, __generator, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Select, stylesFactory, useTheme2 } from '@grafana/ui';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from '../gazetteer/gazetteer';
import { css } from '@emotion/css';
var defaultPaths = [
    {
        label: 'Countries',
        description: 'Lookup countries by name, two letter code, or three letter code',
        value: COUNTRIES_GAZETTEER_PATH,
    },
    {
        label: 'USA States',
        description: 'Lookup states by name or 2 ',
        value: 'public/gazetteer/usa-states.json',
    },
    {
        label: 'Airports',
        description: 'Lookup airports by id or code',
        value: 'public/gazetteer/airports.geojson',
    },
];
export var GazetteerPathEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange, context = _a.context, item = _a.item;
    var styles = getStyles(useTheme2());
    var _b = __read(useState(), 2), gaz = _b[0], setGaz = _b[1];
    var settings = item.settings;
    useEffect(function () {
        function fetchData() {
            return __awaiter(this, void 0, void 0, function () {
                var p;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getGazetteer(value)];
                        case 1:
                            p = _a.sent();
                            setGaz(p);
                            return [2 /*return*/];
                    }
                });
            });
        }
        fetchData();
    }, [value, setGaz]);
    var _c = useMemo(function () {
        var options = (settings === null || settings === void 0 ? void 0 : settings.options) ? __spreadArray([], __read(settings.options), false) : __spreadArray([], __read(defaultPaths), false);
        var current = options.find(function (f) { return f.value === (gaz === null || gaz === void 0 ? void 0 : gaz.path); });
        if (!current && gaz) {
            current = {
                label: gaz.path,
                value: gaz.path,
            };
            options.push(current);
        }
        return { options: options, current: current };
    }, [gaz, settings.options]), current = _c.current, options = _c.options;
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { menuShouldPortal: true, value: current, options: options, onChange: function (v) { return onChange(v.value); }, allowCustomValue: true, formatCreateLabel: function (txt) { return "Load from URL: " + txt; } }),
        gaz && (React.createElement(React.Fragment, null,
            gaz.error && React.createElement(Alert, { title: gaz.error, severity: 'warning' }),
            gaz.count && (React.createElement("div", { className: styles.keys },
                React.createElement("b", null,
                    "(",
                    gaz.count,
                    ")"),
                gaz.examples(10).map(function (k) { return (React.createElement("span", { key: k },
                    k,
                    ",")); }),
                gaz.count > 10 && ' ...'))))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        keys: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: 4px;\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n\n      > span {\n        margin-left: 4px;\n      }\n    "], ["\n      margin-top: 4px;\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n\n      > span {\n        margin-left: 4px;\n      }\n    "]))),
    };
});
var templateObject_1;
//# sourceMappingURL=GazetteerPathEditor.js.map