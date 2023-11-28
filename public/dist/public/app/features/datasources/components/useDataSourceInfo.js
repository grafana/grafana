import React from 'react';
import { Badge } from '@grafana/ui';
export const useDataSourceInfo = (dataSourceInfo) => {
    const info = [];
    const alertingEnabled = dataSourceInfo.alertingSupported;
    info.push({
        label: 'Type',
        value: dataSourceInfo.dataSourcePluginName,
    });
    info.push({
        label: 'Alerting',
        value: (React.createElement(Badge, { color: alertingEnabled ? 'green' : 'red', text: alertingEnabled ? 'Supported' : 'Not supported' })),
    });
    return info;
};
//# sourceMappingURL=useDataSourceInfo.js.map