import { __assign } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import ConfigEditor from './ConfigEditor';
describe('AppInsights ConfigEditor', function () {
    var baseOptions = {
        id: 21,
        uid: 'y',
        orgId: 1,
        name: 'Azure Monitor-10-10',
        type: 'grafana-azure-monitor-datasource',
        typeLogoUrl: '',
        typeName: 'Azure',
        access: 'proxy',
        url: '',
        password: '',
        user: '',
        database: '',
        basicAuth: false,
        basicAuthUser: '',
        basicAuthPassword: '',
        withCredentials: false,
        isDefault: false,
        jsonData: {},
        secureJsonFields: {},
        version: 1,
        readOnly: false,
    };
    var jsonData = {
        subscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
        azureLogAnalyticsSameAs: true,
        cloudName: 'azuremonitor',
    };
    var onOptionsChange = jest.fn();
    it('should not render application insights config for new data sources', function () {
        var options = __assign(__assign({}, baseOptions), { jsonData: jsonData });
        render(React.createElement(ConfigEditor, { options: options, onOptionsChange: onOptionsChange }));
        expect(screen.queryByText('Azure Application Insights')).not.toBeInTheDocument();
    });
    it('should render application insights config for data sources using application insights', function () {
        var options = __assign(__assign({}, baseOptions), { jsonData: __assign(__assign({}, jsonData), { appInsightsAppId: 'abc-123' }), secureJsonFields: {
                appInsightsApiKey: true,
            } });
        render(React.createElement(ConfigEditor, { options: options, onOptionsChange: onOptionsChange }));
        expect(screen.queryByText('Azure Application Insights')).toBeInTheDocument();
    });
});
//# sourceMappingURL=ConfigEditor.test.js.map