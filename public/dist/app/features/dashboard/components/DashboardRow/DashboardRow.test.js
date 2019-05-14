import React from 'react';
import { shallow } from 'enzyme';
import { DashboardRow } from './DashboardRow';
import { PanelModel } from '../../state/PanelModel';
describe('DashboardRow', function () {
    var wrapper, panel, dashboardMock;
    beforeEach(function () {
        dashboardMock = {
            toggleRow: jest.fn(),
            on: jest.fn(),
            meta: {
                canEdit: true,
            },
        };
        panel = new PanelModel({ collapsed: false });
        wrapper = shallow(React.createElement(DashboardRow, { panel: panel, dashboard: dashboardMock }));
    });
    it('Should not have collapsed class when collaped is false', function () {
        expect(wrapper.find('.dashboard-row')).toHaveLength(1);
        expect(wrapper.find('.dashboard-row--collapsed')).toHaveLength(0);
    });
    it('Should collapse after clicking title', function () {
        wrapper.find('.dashboard-row__title').simulate('click');
        expect(wrapper.find('.dashboard-row--collapsed')).toHaveLength(1);
        expect(dashboardMock.toggleRow.mock.calls).toHaveLength(1);
    });
    it('should have two actions as admin', function () {
        expect(wrapper.find('.dashboard-row__actions .pointer')).toHaveLength(2);
    });
    it('should not show row drag handle when cannot edit', function () {
        dashboardMock.meta.canEdit = false;
        wrapper = shallow(React.createElement(DashboardRow, { panel: panel, dashboard: dashboardMock }));
        expect(wrapper.find('.dashboard-row__drag')).toHaveLength(0);
    });
    it('should have zero actions when cannot edit', function () {
        dashboardMock.meta.canEdit = false;
        panel = new PanelModel({ collapsed: false });
        wrapper = shallow(React.createElement(DashboardRow, { panel: panel, dashboard: dashboardMock }));
        expect(wrapper.find('.dashboard-row__actions .pointer')).toHaveLength(0);
    });
});
//# sourceMappingURL=DashboardRow.test.js.map