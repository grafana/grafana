import { __makeTemplateObject } from "tslib";
import React, { Fragment, useEffect } from 'react';
import { Input, InlineLabel } from '@grafana/ui';
import { changeMetricAttribute } from '../../state/actions';
import { css } from '@emotion/css';
import { AddRemove } from '../../../../AddRemove';
import { useStatelessReducer, useDispatch } from '../../../../../hooks/useStatelessReducer';
import { MetricPicker } from '../../../../MetricPicker';
import { reducer } from './state/reducer';
import { addPipelineVariable, removePipelineVariable, renamePipelineVariable, changePipelineVariableMetric, } from './state/actions';
import { SettingField } from '../SettingField';
import { uniqueId } from 'lodash';
export var BucketScriptSettingsEditor = function (_a) {
    var _b;
    var value = _a.value, previousMetrics = _a.previousMetrics;
    var upperStateDispatch = useDispatch();
    var dispatch = useStatelessReducer(function (newValue) {
        return upperStateDispatch(changeMetricAttribute({ metric: value, attribute: 'pipelineVariables', newValue: newValue }));
    }, value.pipelineVariables, reducer);
    // The model might not have pipeline variables (or an empty array of pipeline vars) in it because of the way it was built in previous versions of the datasource.
    // If this is the case we add a default one.
    useEffect(function () {
        var _a;
        if (!((_a = value.pipelineVariables) === null || _a === void 0 ? void 0 : _a.length)) {
            dispatch(addPipelineVariable());
        }
    }, [dispatch, (_b = value.pipelineVariables) === null || _b === void 0 ? void 0 : _b.length]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          display: flex;\n        "], ["\n          display: flex;\n        "]))) },
            React.createElement(InlineLabel, { width: 16 }, "Variables"),
            React.createElement("div", { className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            display: grid;\n            grid-template-columns: 1fr auto;\n            row-gap: 4px;\n            margin-bottom: 4px;\n          "], ["\n            display: grid;\n            grid-template-columns: 1fr auto;\n            row-gap: 4px;\n            margin-bottom: 4px;\n          "]))) }, value.pipelineVariables.map(function (pipelineVar, index) { return (
            // index as a key doesn't work here since removing an element
            // in the middle of the list, will cause the next element to obtain the same key as the removed one.
            // this will cause react to "drop" the last element of the list instead of the just removed one,
            // and the default value for the input won't match the model as the DOM won't get updated.
            // using pipelineVar.name is not an option since it might be duplicated by the user.
            // generating a unique key on every render, while is probably not the best solution in terms of performance
            // ensures the UI is in a correct state. We might want to optimize this if we see perf issue in the future.
            React.createElement(Fragment, { key: uniqueId('es-bs-') },
                React.createElement("div", { className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n                  display: grid;\n                  column-gap: 4px;\n                  grid-template-columns: auto auto;\n                "], ["\n                  display: grid;\n                  column-gap: 4px;\n                  grid-template-columns: auto auto;\n                "]))) },
                    React.createElement(Input, { defaultValue: pipelineVar.name, placeholder: "Variable Name", onBlur: function (e) { return dispatch(renamePipelineVariable({ newName: e.target.value, index: index })); } }),
                    React.createElement(MetricPicker, { onChange: function (e) { return dispatch(changePipelineVariableMetric({ newMetric: e.value.id, index: index })); }, options: previousMetrics, value: pipelineVar.pipelineAgg })),
                React.createElement(AddRemove, { index: index, elements: value.pipelineVariables || [], onAdd: function () { return dispatch(addPipelineVariable()); }, onRemove: function () { return dispatch(removePipelineVariable(index)); } }))); }))),
        React.createElement(SettingField, { label: "Script", metric: value, settingName: "script", tooltip: "Elasticsearch v5.0 and above: Scripting language is Painless. Use params.<var> to reference a variable. Elasticsearch pre-v5.0: Scripting language is per default Groovy if not changed. For Groovy use <var> to reference a variable.", placeholder: "params.var1 / params.var2" })));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=index.js.map