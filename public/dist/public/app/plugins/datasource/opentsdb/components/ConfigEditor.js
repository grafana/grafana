import React from 'react';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings } from '@grafana/ui';
import { OpenTsdbDetails } from './OpenTsdbDetails';
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:4242", dataSourceConfig: options, onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled }),
        React.createElement(OpenTsdbDetails, { value: options, onChange: onOptionsChange })));
};
//# sourceMappingURL=ConfigEditor.js.map