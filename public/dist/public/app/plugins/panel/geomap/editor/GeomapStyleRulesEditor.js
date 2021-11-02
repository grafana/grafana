import { __read, __spreadArray, __values } from "tslib";
import React, { useCallback } from 'react';
import { ComparisonOperation } from '../types';
import { Button } from '@grafana/ui';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonMapper';
import { StyleRuleEditor } from './StyleRuleEditor';
export var GeomapStyleRulesEditor = function (props) {
    var value = props.value, onChange = props.onChange, context = props.context;
    var OPTIONS = getComparisonOperatorOptions();
    var onAddRule = useCallback(function () {
        onChange(__spreadArray(__spreadArray([], __read(value), false), [DEFAULT_STYLE_RULE], false));
    }, [onChange, value]);
    var onRuleChange = useCallback(function (idx) { return function (style) {
        var copyStyles = __spreadArray([], __read(value), false);
        if (style) {
            copyStyles[idx] = style;
        }
        else {
            //assume undefined is only returned on delete
            copyStyles.splice(idx, 1);
        }
        onChange(copyStyles);
    }; }, [onChange, value]);
    var styleOptions = value &&
        value.map(function (style, idx) {
            var itemSettings = {
                settings: { options: OPTIONS },
            };
            return (React.createElement(StyleRuleEditor, { value: style, onChange: onRuleChange(idx), context: context, item: itemSettings, key: idx + "-" + style.rule }));
        });
    return (React.createElement(React.Fragment, null,
        styleOptions,
        React.createElement(Button, { size: "sm", icon: "plus", onClick: onAddRule, variant: "secondary", "aria-label": 'Add geomap style rule' }, 'Add style rule')));
};
var getComparisonOperatorOptions = function () {
    var e_1, _a;
    var options = [];
    try {
        for (var _b = __values(Object.values(ComparisonOperation)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var value = _c.value;
            options.push({ value: value, label: value });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return options;
};
//# sourceMappingURL=GeomapStyleRulesEditor.js.map