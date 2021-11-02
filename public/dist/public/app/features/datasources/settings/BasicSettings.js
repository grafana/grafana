import React from 'react';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
var Input = LegacyForms.Input, Switch = LegacyForms.Switch;
var BasicSettings = function (_a) {
    var dataSourceName = _a.dataSourceName, isDefault = _a.isDefault, onDefaultChange = _a.onDefaultChange, onNameChange = _a.onNameChange;
    return (React.createElement("div", { className: "gf-form-group", "aria-label": "Datasource settings page basic settings" },
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form max-width-30", style: { marginRight: '3px' } },
                React.createElement(InlineFormLabel, { tooltip: 'The name is used when you select the data source in panels. The default data source is ' +
                        'preselected in new panels.' }, "Name"),
                React.createElement(Input, { className: "gf-form-input max-width-23", type: "text", value: dataSourceName, placeholder: "Name", onChange: function (event) { return onNameChange(event.target.value); }, required: true, "aria-label": selectors.pages.DataSource.name })),
            React.createElement(Switch, { label: "Default", checked: isDefault, onChange: function (event) {
                    // @ts-ignore
                    onDefaultChange(event.target.checked);
                } }))));
};
export default BasicSettings;
//# sourceMappingURL=BasicSettings.js.map