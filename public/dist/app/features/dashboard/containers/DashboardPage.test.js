import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { DashboardPage, mapStateToProps } from './DashboardPage';
import { DashboardModel } from '../state';
import { cleanUpDashboard } from '../state/actions';
import { getNoPayloadActionCreatorMock } from 'app/core/redux';
import { DashboardRouteInfo, DashboardInitPhase } from 'app/types';
jest.mock('app/features/dashboard/components/DashboardSettings/SettingsCtrl', function () { return ({}); });
function getTestDashboard(overrides, metaOverrides) {
    var data = Object.assign({
        title: 'My dashboard',
        panels: [
            {
                id: 1,
                type: 'graph',
                title: 'My graph',
                gridPos: { x: 0, y: 0, w: 1, h: 1 },
            },
        ],
    }, overrides);
    var meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
    return new DashboardModel(data, meta);
}
function dashboardPageScenario(description, scenarioFn) {
    describe(description, function () {
        var setupFn;
        var ctx = {
            cleanUpDashboardMock: getNoPayloadActionCreatorMock(cleanUpDashboard),
            setup: function (fn) {
                setupFn = fn;
            },
            setDashboardProp: function (overrides, metaOverrides) {
                ctx.dashboard = getTestDashboard(overrides, metaOverrides);
                ctx.wrapper.setProps({ dashboard: ctx.dashboard });
            },
            mount: function (propOverrides) {
                var props = {
                    urlSlug: 'my-dash',
                    $scope: {},
                    urlUid: '11',
                    $injector: {},
                    routeInfo: DashboardRouteInfo.Normal,
                    urlEdit: false,
                    urlFullscreen: false,
                    initPhase: DashboardInitPhase.NotStarted,
                    isInitSlow: false,
                    initDashboard: jest.fn(),
                    updateLocation: jest.fn(),
                    notifyApp: jest.fn(),
                    cleanUpDashboard: ctx.cleanUpDashboardMock,
                    dashboard: null,
                };
                Object.assign(props, propOverrides);
                ctx.dashboard = props.dashboard;
                ctx.wrapper = shallow(React.createElement(DashboardPage, tslib_1.__assign({}, props)));
            },
        };
        beforeEach(function () {
            setupFn();
        });
        scenarioFn(ctx);
    });
}
describe('DashboardPage', function () {
    dashboardPageScenario('Given initial state', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
        });
        it('Should render nothing', function () {
            expect(ctx.wrapper).toMatchSnapshot();
        });
    });
    dashboardPageScenario('Dashboard is fetching slowly', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.wrapper.setProps({
                isInitSlow: true,
                initPhase: DashboardInitPhase.Fetching,
            });
        });
        it('Should render slow init state', function () {
            expect(ctx.wrapper).toMatchSnapshot();
        });
    });
    dashboardPageScenario('Dashboard init completed ', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp();
        });
        it('Should update title', function () {
            expect(document.title).toBe('My dashboard - Grafana');
        });
        it('Should render dashboard grid', function () {
            expect(ctx.wrapper).toMatchSnapshot();
        });
    });
    dashboardPageScenario('When user goes into panel edit', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp();
            ctx.wrapper.setProps({
                urlFullscreen: true,
                urlEdit: true,
                urlPanelId: '1',
            });
        });
        it('Should update model state to fullscreen & edit', function () {
            expect(ctx.dashboard.meta.fullscreen).toBe(true);
            expect(ctx.dashboard.meta.isEditing).toBe(true);
        });
        it('Should update component state to fullscreen and edit', function () {
            var state = ctx.wrapper.state();
            expect(state.isEditing).toBe(true);
            expect(state.isFullscreen).toBe(true);
        });
    });
    dashboardPageScenario('When user goes back to dashboard from panel edit', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp();
            ctx.wrapper.setState({ scrollTop: 100 });
            ctx.wrapper.setProps({
                urlFullscreen: true,
                urlEdit: true,
                urlPanelId: '1',
            });
            ctx.wrapper.setProps({
                urlFullscreen: false,
                urlEdit: false,
                urlPanelId: null,
            });
        });
        it('Should update model state normal state', function () {
            expect(ctx.dashboard.meta.fullscreen).toBe(false);
            expect(ctx.dashboard.meta.isEditing).toBe(false);
        });
        it('Should update component state to normal and restore scrollTop', function () {
            var state = ctx.wrapper.state();
            expect(state.isEditing).toBe(false);
            expect(state.isFullscreen).toBe(false);
            expect(state.scrollTop).toBe(100);
        });
    });
    dashboardPageScenario('When dashboard has editview url state', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp();
            ctx.wrapper.setProps({
                editview: 'settings',
            });
        });
        it('should render settings view', function () {
            expect(ctx.wrapper).toMatchSnapshot();
        });
        it('should set animation state', function () {
            expect(ctx.wrapper.state().isSettingsOpening).toBe(true);
        });
    });
    dashboardPageScenario('When adding panel', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp();
            ctx.wrapper.setState({ scrollTop: 100 });
            ctx.wrapper.instance().onAddPanel();
        });
        it('should set scrollTop to 0', function () {
            expect(ctx.wrapper.state().scrollTop).toBe(0);
        });
        it('should add panel widget to dashboard panels', function () {
            expect(ctx.dashboard.panels[0].type).toBe('add-panel');
        });
    });
    dashboardPageScenario('Given panel with id 0', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp({
                panels: [{ id: 0, type: 'graph' }],
                schemaVersion: 17,
            });
            ctx.wrapper.setProps({
                urlEdit: true,
                urlFullscreen: true,
                urlPanelId: '0',
            });
        });
        it('Should go into edit mode', function () {
            expect(ctx.wrapper.state().isEditing).toBe(true);
            expect(ctx.wrapper.state().fullscreenPanel.id).toBe(0);
        });
    });
    dashboardPageScenario('When dashboard unmounts', function (ctx) {
        ctx.setup(function () {
            ctx.mount();
            ctx.setDashboardProp({
                panels: [{ id: 0, type: 'graph' }],
                schemaVersion: 17,
            });
            ctx.wrapper.unmount();
        });
        it('Should call clean up action', function () {
            expect(ctx.cleanUpDashboardMock.calls).toBe(1);
        });
    });
    describe('mapStateToProps with bool fullscreen', function () {
        var props = mapStateToProps({
            location: {
                routeParams: {},
                query: {
                    fullscreen: true,
                    edit: false,
                },
            },
            dashboard: {},
        });
        expect(props.urlFullscreen).toBe(true);
        expect(props.urlEdit).toBe(false);
    });
    describe('mapStateToProps with string edit true', function () {
        var props = mapStateToProps({
            location: {
                routeParams: {},
                query: {
                    fullscreen: false,
                    edit: 'true',
                },
            },
            dashboard: {},
        });
        expect(props.urlFullscreen).toBe(false);
        expect(props.urlEdit).toBe(true);
    });
});
//# sourceMappingURL=DashboardPage.test.js.map