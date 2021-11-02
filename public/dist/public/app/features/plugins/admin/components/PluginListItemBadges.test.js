import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { PluginListItemBadges } from './PluginListItemBadges';
import { config } from '@grafana/runtime';
describe('PluginListItemBadges', function () {
    var plugin = {
        description: 'The test plugin',
        downloads: 5,
        id: 'test-plugin',
        info: {
            logos: {
                small: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/small',
                large: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/large',
            },
        },
        name: 'Testing Plugin',
        orgName: 'Test',
        popularity: 0,
        signature: PluginSignatureStatus.valid,
        publishedAt: '2020-09-01',
        updatedAt: '2021-06-28',
        version: '1.0.0',
        hasUpdate: false,
        isInstalled: false,
        isCore: false,
        isDev: false,
        isEnterprise: false,
        isDisabled: false,
    };
    afterEach(function () {
        jest.clearAllMocks();
    });
    it('renders a plugin signature badge', function () {
        render(React.createElement(PluginListItemBadges, { plugin: plugin }));
        expect(screen.getByText(/signed/i)).toBeVisible();
    });
    it('renders an installed badge', function () {
        render(React.createElement(PluginListItemBadges, { plugin: __assign(__assign({}, plugin), { isInstalled: true }) }));
        expect(screen.getByText(/signed/i)).toBeVisible();
        expect(screen.getByText(/installed/i)).toBeVisible();
    });
    it('renders an enterprise badge (when a license is valid)', function () {
        config.licenseInfo.hasValidLicense = true;
        render(React.createElement(PluginListItemBadges, { plugin: __assign(__assign({}, plugin), { isEnterprise: true }) }));
        expect(screen.getByText(/enterprise/i)).toBeVisible();
        expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument();
    });
    it('renders an enterprise badge with icon and link (when a license is invalid)', function () {
        config.licenseInfo.hasValidLicense = false;
        render(React.createElement(PluginListItemBadges, { plugin: __assign(__assign({}, plugin), { isEnterprise: true }) }));
        expect(screen.getByText(/enterprise/i)).toBeVisible();
        expect(screen.getByLabelText(/lock icon/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
    });
    it('renders a error badge (when plugin has an error', function () {
        render(React.createElement(PluginListItemBadges, { plugin: __assign(__assign({}, plugin), { isDisabled: true, error: PluginErrorCode.modifiedSignature }) }));
        expect(screen.getByText(/disabled/i)).toBeVisible();
    });
});
//# sourceMappingURL=PluginListItemBadges.test.js.map