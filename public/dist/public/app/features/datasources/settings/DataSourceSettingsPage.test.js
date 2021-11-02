import { __assign } from "tslib";
import React from 'react';
import { DataSourceSettingsPage } from './DataSourceSettingsPage';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import { screen, render } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';
import { PluginState } from '@grafana/data';
jest.mock('app/core/core', function () {
    return {
        contextSrv: {
            hasPermission: function () { return true; },
        },
    };
});
var getMockNode = function () { return ({
    text: 'text',
    subTitle: 'subtitle',
    icon: 'icon',
}); };
var getProps = function () { return (__assign(__assign({}, getRouteComponentProps()), { navModel: {
        node: getMockNode(),
        main: getMockNode(),
    }, dataSource: getMockDataSource(), dataSourceMeta: getMockPlugin(), dataSourceId: 'x', deleteDataSource: jest.fn(), loadDataSource: jest.fn(), setDataSourceName: setDataSourceName, updateDataSource: jest.fn(), initDataSourceSettings: jest.fn(), testDataSource: jest.fn(), setIsDefault: setIsDefault, dataSourceLoaded: dataSourceLoaded, cleanUpAction: cleanUpAction, page: null, plugin: null, loadError: null, loading: false, testingStatus: {} })); };
describe('Render', function () {
    it('should not render loading when props are ready', function () {
        render(React.createElement(DataSourceSettingsPage, __assign({}, getProps())));
        expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
    });
    it('should render loading if datasource is not ready', function () {
        var mockProps = getProps();
        mockProps.dataSource.id = 0;
        mockProps.loading = true;
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByText('Loading ...')).toBeInTheDocument();
    });
    it('should render beta info text if plugin state is beta', function () {
        var mockProps = getProps();
        mockProps.dataSourceMeta.state = PluginState.beta;
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByTitle('This feature is close to complete but not fully tested')).toBeInTheDocument();
    });
    it('should render alpha info text if plugin state is alpha', function () {
        var mockProps = getProps();
        mockProps.dataSourceMeta.state = PluginState.alpha;
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByTitle('This feature is experimental and future updates might not be backward compatible')).toBeInTheDocument();
    });
    it('should not render is ready only message is readOnly is false', function () {
        var mockProps = getProps();
        mockProps.dataSource.readOnly = false;
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.queryByLabelText(selectors.pages.DataSource.readOnly)).not.toBeInTheDocument();
    });
    it('should render is ready only message is readOnly is true', function () {
        var mockProps = getProps();
        mockProps.dataSource.readOnly = true;
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByLabelText(selectors.pages.DataSource.readOnly)).toBeInTheDocument();
    });
    it('should render error message with detailed message', function () {
        var mockProps = __assign(__assign({}, getProps()), { testingStatus: {
                message: 'message',
                status: 'error',
                details: { message: 'detailed message' },
            } });
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
        expect(screen.getByText(mockProps.testingStatus.details.message)).toBeInTheDocument();
    });
    it('should render error message with empty details', function () {
        var mockProps = __assign(__assign({}, getProps()), { testingStatus: {
                message: 'message',
                status: 'error',
                details: {},
            } });
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
    });
    it('should render error message without details', function () {
        var mockProps = __assign(__assign({}, getProps()), { testingStatus: {
                message: 'message',
                status: 'error',
            } });
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
    });
    it('should render verbose error message with detailed verbose error message', function () {
        var mockProps = __assign(__assign({}, getProps()), { testingStatus: {
                message: 'message',
                status: 'error',
                details: { message: 'detailed message', verboseMessage: 'verbose message' },
            } });
        render(React.createElement(DataSourceSettingsPage, __assign({}, mockProps)));
        expect(screen.getByText(mockProps.testingStatus.details.verboseMessage)).toBeInTheDocument();
    });
});
//# sourceMappingURL=DataSourceSettingsPage.test.js.map