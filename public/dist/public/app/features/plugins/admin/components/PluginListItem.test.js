import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { PluginListItem } from './PluginListItem';
import { PluginListDisplayMode } from '../types';
/**
 * The whole Icon component needs to be mock
 * currently is using react-inlinesvg that does not render the icon svg in the test.
 *
 * There is solution to mock the library on __mocks__
 * https://github.com/gilbarbara/react-inlinesvg/issues/145
 * But unfortunately that causes conflict with DashboardSearch.test.tsx
 */
jest.mock('@grafana/ui', function () {
    var IconMock = function (_a) {
        var title = _a.title;
        return (React.createElement("svg", null,
            React.createElement("title", null,
                " ",
                title,
                " ")));
    };
    IconMock.displayName = 'Icon';
    return Object.assign({}, jest.requireActual('@grafana/ui'), { Icon: IconMock });
});
describe('PluginListItem', function () {
    afterEach(function () {
        jest.clearAllMocks();
    });
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
    /** As Grid */
    it('renders a card with link, image, name, orgName and badges', function () {
        render(React.createElement(PluginListItem, { plugin: plugin, pathName: "/plugins" }));
        expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin?page=overview');
        var logo = screen.getByRole('img');
        expect(logo).toHaveAttribute('src', plugin.info.logos.small);
        expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
        expect(screen.getByText("By " + plugin.orgName)).toBeVisible();
        expect(screen.getByText(/signed/i)).toBeVisible();
        expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
    });
    it('renders a datasource plugin with correct icon', function () {
        var datasourcePlugin = __assign(__assign({}, plugin), { type: PluginType.datasource });
        render(React.createElement(PluginListItem, { plugin: datasourcePlugin, pathName: "" }));
        expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
    });
    it('renders a panel plugin with correct icon', function () {
        var panelPlugin = __assign(__assign({}, plugin), { type: PluginType.panel });
        render(React.createElement(PluginListItem, { plugin: panelPlugin, pathName: "" }));
        expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
    });
    it('renders an app plugin with correct icon', function () {
        var appPlugin = __assign(__assign({}, plugin), { type: PluginType.app });
        render(React.createElement(PluginListItem, { plugin: appPlugin, pathName: "" }));
        expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
    });
    it('renders a disabled plugin with a badge to indicate its error', function () {
        var pluginWithError = __assign(__assign({}, plugin), { isDisabled: true, error: PluginErrorCode.modifiedSignature });
        render(React.createElement(PluginListItem, { plugin: pluginWithError, pathName: "" }));
        expect(screen.getByText(/disabled/i)).toBeVisible();
    });
    /** As List */
    it('renders a row with link, image, name, orgName and badges', function () {
        render(React.createElement(PluginListItem, { plugin: plugin, pathName: "/plugins", displayMode: PluginListDisplayMode.List }));
        expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin?page=overview');
        var logo = screen.getByRole('img');
        expect(logo).toHaveAttribute('src', plugin.info.logos.small);
        expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
        expect(screen.getByText("By " + plugin.orgName)).toBeVisible();
        expect(screen.getByText(/signed/i)).toBeVisible();
        expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
    });
    it('renders a datasource plugin with correct icon', function () {
        var datasourcePlugin = __assign(__assign({}, plugin), { type: PluginType.datasource });
        render(React.createElement(PluginListItem, { plugin: datasourcePlugin, pathName: "", displayMode: PluginListDisplayMode.List }));
        expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
    });
    it('renders a panel plugin with correct icon', function () {
        var panelPlugin = __assign(__assign({}, plugin), { type: PluginType.panel });
        render(React.createElement(PluginListItem, { plugin: panelPlugin, pathName: "", displayMode: PluginListDisplayMode.List }));
        expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
    });
    it('renders an app plugin with correct icon', function () {
        var appPlugin = __assign(__assign({}, plugin), { type: PluginType.app });
        render(React.createElement(PluginListItem, { plugin: appPlugin, pathName: "", displayMode: PluginListDisplayMode.List }));
        expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
    });
    it('renders a disabled plugin with a badge to indicate its error', function () {
        var pluginWithError = __assign(__assign({}, plugin), { isDisabled: true, error: PluginErrorCode.modifiedSignature });
        render(React.createElement(PluginListItem, { plugin: pluginWithError, pathName: "", displayMode: PluginListDisplayMode.List }));
        expect(screen.getByText(/disabled/i)).toBeVisible();
    });
});
//# sourceMappingURL=PluginListItem.test.js.map