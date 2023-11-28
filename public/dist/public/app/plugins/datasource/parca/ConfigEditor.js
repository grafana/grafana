import React from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { config } from 'app/core/config';
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: 'http://localhost:7070', dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled })));
};
//# sourceMappingURL=ConfigEditor.js.map