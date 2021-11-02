import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { useFormContext } from 'react-hook-form';
import { SelectWithAdd } from './SelectWIthAdd';
import { Field, InputControl, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
export var GroupAndNamespaceFields = function (_a) {
    var _b, _c, _d, _e, _f;
    var rulesSourceName = _a.rulesSourceName;
    var _g = useFormContext(), control = _g.control, watch = _g.watch, errors = _g.formState.errors, setValue = _g.setValue;
    var style = useStyles2(getStyle);
    var _h = __read(useState(false), 2), customGroup = _h[0], setCustomGroup = _h[1];
    var rulerRequests = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    var dispatch = useDispatch();
    useEffect(function () {
        dispatch(fetchRulerRulesAction({ rulesSourceName: rulesSourceName }));
    }, [rulesSourceName, dispatch]);
    var rulesConfig = (_b = rulerRequests[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.result;
    var namespace = watch('namespace');
    var namespaceOptions = useMemo(function () {
        return rulesConfig ? Object.keys(rulesConfig).map(function (namespace) { return ({ label: namespace, value: namespace }); }) : [];
    }, [rulesConfig]);
    var groupOptions = useMemo(function () { var _a; return (namespace && ((_a = rulesConfig === null || rulesConfig === void 0 ? void 0 : rulesConfig[namespace]) === null || _a === void 0 ? void 0 : _a.map(function (group) { return ({ label: group.name, value: group.name }); }))) || []; }, [namespace, rulesConfig]);
    return (React.createElement("div", { className: style.flexRow },
        React.createElement(Field, { "data-testid": "namespace-picker", label: "Namespace", error: (_c = errors.namespace) === null || _c === void 0 ? void 0 : _c.message, invalid: !!((_d = errors.namespace) === null || _d === void 0 ? void 0 : _d.message) },
            React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, onChange = _b.onChange, ref = _b.ref, field = __rest(_b, ["onChange", "ref"]);
                    return (React.createElement(SelectWithAdd, __assign({}, field, { className: style.input, onChange: function (value) {
                            setValue('group', ''); //reset if namespace changes
                            onChange(value);
                        }, onCustomChange: function (custom) {
                            custom && setCustomGroup(true);
                        }, options: namespaceOptions, width: 42 })));
                }, name: "namespace", control: control, rules: {
                    required: { value: true, message: 'Required.' },
                } })),
        React.createElement(Field, { "data-testid": "group-picker", label: "Group", error: (_e = errors.group) === null || _e === void 0 ? void 0 : _e.message, invalid: !!((_f = errors.group) === null || _f === void 0 ? void 0 : _f.message) },
            React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return (React.createElement(SelectWithAdd, __assign({}, field, { options: groupOptions, width: 42, custom: customGroup, className: style.input })));
                }, name: "group", control: control, rules: {
                    required: { value: true, message: 'Required.' },
                } }))));
};
var getStyle = function (theme) { return ({
    flexRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-start;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(3)),
    input: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 330px !important;\n  "], ["\n    width: 330px !important;\n  "]))),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=GroupAndNamespaceFields.js.map