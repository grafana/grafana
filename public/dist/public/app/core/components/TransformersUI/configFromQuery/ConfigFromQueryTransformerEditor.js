import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { FieldMatcherID, PluginState, } from '@grafana/data';
import { configFromDataTransformer } from './configFromQuery';
import { fieldMatchersUI, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { FieldToConfigMappingEditor } from '../fieldToConfigMapping/FieldToConfigMappingEditor';
import { css } from '@emotion/css';
export function ConfigFromQueryTransformerEditor(_a) {
    var _b;
    var input = _a.input, onChange = _a.onChange, options = _a.options;
    var styles = useStyles2(getStyles);
    var refIds = input
        .map(function (x) { return x.refId; })
        .filter(function (x) { return x != null; })
        .map(function (x) { return ({ label: x, value: x }); });
    var currentRefId = options.configRefId || 'config';
    var currentMatcher = (_b = options.applyTo) !== null && _b !== void 0 ? _b : { id: FieldMatcherID.byType, options: 'number' };
    var matcherUI = fieldMatchersUI.get(currentMatcher.id);
    var configFrame = input.find(function (x) { return x.refId === currentRefId; });
    var onRefIdChange = function (value) {
        onChange(__assign(__assign({}, options), { configRefId: value.value || 'config' }));
    };
    var onMatcherChange = function (value) {
        onChange(__assign(__assign({}, options), { applyTo: { id: value.value } }));
    };
    var onMatcherConfigChange = function (matcherOption) {
        onChange(__assign(__assign({}, options), { applyTo: { id: currentMatcher.id, options: matcherOption } }));
    };
    var matchers = fieldMatchersUI
        .list()
        .filter(function (o) { return !o.excludeFromPicker; })
        .map(function (i) { return ({ label: i.name, value: i.id, description: i.description }); });
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Config query", labelWidth: 20 },
                React.createElement(Select, { menuShouldPortal: true, onChange: onRefIdChange, options: refIds, value: currentRefId, width: 30 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Apply to", labelWidth: 20 },
                React.createElement(Select, { menuShouldPortal: true, onChange: onMatcherChange, options: matchers, value: currentMatcher.id, width: 30 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Apply to options", labelWidth: 20, className: styles.matcherOptions },
                React.createElement(matcherUI.component, { matcher: matcherUI.matcher, data: input, options: currentMatcher.options, onChange: onMatcherConfigChange }))),
        React.createElement(InlineFieldRow, null, configFrame && (React.createElement(FieldToConfigMappingEditor, { frame: configFrame, mappings: options.mappings, onChange: function (mappings) { return onChange(__assign(__assign({}, options), { mappings: mappings })); }, withReducers: true })))));
}
export var configFromQueryTransformRegistryItem = {
    id: configFromDataTransformer.id,
    editor: ConfigFromQueryTransformerEditor,
    transformation: configFromDataTransformer,
    name: configFromDataTransformer.name,
    description: configFromDataTransformer.description,
    state: PluginState.beta,
    help: "\n### Use cases\n\nThis transformation allows you select one query and from it extract standard options such as \n**Min**, **Max**, **Unit**, and **Thresholds** and apply them to other query results.\nThis enables dynamic query driven visualization configuration.\n\n### Options\n\n- **Config query**: Selet the query that returns the data you want to use as configuration.\n- **Apply to**: Select what fields or series to apply the configuration to.\n- **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.\n\n### Field mapping table\n\nBelow the configuration listed above you will find the field table. Here all fields found in the data returned by the config query will be listed along with a **Use as** and **Select** option. This table gives you control over what field should be mapped to which config property and if there are multiple rows which value to select.\n\n## Example\n\nInput[0] (From query: A, name: ServerA)\n\n| Time          | Value |\n| ------------- | ----- |\n| 1626178119127 | 10    |\n| 1626178119129 | 30    |\n\nInput[1] (From query: B)\n\n| Time          | Value |\n| ------------- | ----- |\n| 1626178119127 | 100   |\n| 1626178119129 | 100   |\n\nOutput (Same as Input[0] but now with config on the Value field)\n\n| Time          | Value (config: Max=100) |\n| ------------- | ----------------------- |\n| 1626178119127 | 10                      |\n| 1626178119129 | 30                      |\n\nEach row in the source data becomes a separate field. Each field now also has a maximum\nconfiguration option set. Options such as **min**, **max**, **unit**, and **thresholds** are all part of field configuration, and if they are set like this, they will be used by the visualization instead of any options that are manually configured.\nin the panel editor options pane.\n\n## Value mappings\n\nYou can also transform a query result into value mappings. This is is a bit different because every\nrow in the configuration query result is used to define a single value mapping row. See the following example.\n\nConfig query result:\n\n| Value | Text   | Color |\n| ----- | ------ | ----- |\n| L     | Low    | blue  |\n| M     | Medium | green |\n| H     | High   | red   |\n\nIn the field mapping specify:\n\n| Field | Use as                  | Select     |\n| ----- | ----------------------- | ---------- |\n| Value | Value mappings / Value  | All values |\n| Text  | Value mappings / Text   | All values |\n| Color | Value mappings / Ciolor | All values |\n\nGrafana will build the value mappings from you query result and apply it the the real data query results. You should see values being mapped and colored according to the config query results.\n",
};
var getStyles = function (theme) { return ({
    matcherOptions: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    min-width: 404px;\n  "], ["\n    min-width: 404px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=ConfigFromQueryTransformerEditor.js.map