import React from 'react';
import { FormLabel, Switch } from '@grafana/ui';
var BasicSettings = function (_a) {
    var dataSourceName = _a.dataSourceName, isDefault = _a.isDefault, onDefaultChange = _a.onDefaultChange, onNameChange = _a.onNameChange;
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form max-width-30", style: { marginRight: '3px' } },
                React.createElement(FormLabel, { tooltip: 'The name is used when you select the data source in panels. The Default data source is ' +
                        'preselected in new panels.' }, "Name"),
                React.createElement("input", { className: "gf-form-input max-width-23", type: "text", value: dataSourceName, placeholder: "Name", onChange: function (event) { return onNameChange(event.target.value); }, required: true })),
            React.createElement(Switch, { label: "Default", checked: isDefault, onChange: function (event) { return onDefaultChange(event.target.checked); } }))));
};
export default BasicSettings;
//# sourceMappingURL=BasicSettings.js.map