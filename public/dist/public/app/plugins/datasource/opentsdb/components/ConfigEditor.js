import React from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { OpenTsdbDetails } from './OpenTsdbDetails';
export var ConfigEditor = function (props) {
    var options = props.options, onOptionsChange = props.onOptionsChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:4242", dataSourceConfig: options, onChange: onOptionsChange }),
        React.createElement(OpenTsdbDetails, { value: options, onChange: onOptionsChange })));
};
//# sourceMappingURL=ConfigEditor.js.map