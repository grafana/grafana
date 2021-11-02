import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { DashboardGrid } from './DashboardGrid';
import { DashboardModel } from '../state';
function getTestDashboard(overrides, metaOverrides) {
    var data = Object.assign({
        title: 'My dashboard',
        panels: [
            {
                id: 1,
                type: 'graph',
                title: 'My graph',
                gridPos: { x: 0, y: 0, w: 24, h: 10 },
            },
            {
                id: 2,
                type: 'graph2',
                title: 'My graph2',
                gridPos: { x: 0, y: 10, w: 25, h: 10 },
            },
            {
                id: 3,
                type: 'graph3',
                title: 'My graph3',
                gridPos: { x: 0, y: 20, w: 25, h: 100 },
            },
            {
                id: 4,
                type: 'graph4',
                title: 'My graph4',
                gridPos: { x: 0, y: 120, w: 25, h: 10 },
            },
        ],
    }, overrides);
    var meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
    return new DashboardModel(data, meta);
}
function dashboardGridScenario(description, scenarioFn) {
    describe(description, function () {
        var setupFn;
        var ctx = {
            setup: function (fn) {
                setupFn = fn;
            },
            props: {
                editPanel: null,
                viewPanel: null,
                scrollTop: 0,
                dashboard: getTestDashboard(),
            },
            setProps: function (props) {
                Object.assign(ctx.props, props);
                if (ctx.wrapper) {
                    ctx.wrapper.setProps(ctx.props);
                }
            },
        };
        beforeEach(function () {
            setupFn();
            ctx.wrapper = shallow(React.createElement(DashboardGrid, __assign({}, ctx.props)));
        });
        scenarioFn(ctx);
    });
}
describe('DashboardGrid', function () {
    dashboardGridScenario('Can render dashboard grid', function (ctx) {
        ctx.setup(function () { });
        it('Should render', function () {
            expect(ctx.wrapper).toMatchSnapshot();
        });
    });
});
//# sourceMappingURL=DashboardGrid.test.js.map