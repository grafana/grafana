import React from 'react';
import { render } from '@testing-library/react';
import { DashNavTimeControls } from './DashNavTimeControls';
import { getDashboardModel } from '../../../../../test/helpers/getDashboardModel';
describe('DashNavTimeControls', function () {
    var dashboardModel;
    beforeEach(function () {
        var json = {
            panels: [
                {
                    datasource: null,
                    gridPos: {
                        h: 3,
                        w: 24,
                        x: 0,
                        y: 8,
                    },
                    id: 1,
                    type: 'welcome',
                },
            ],
            refresh: '',
            templating: {
                list: [],
            },
        };
        dashboardModel = getDashboardModel(json);
    });
    it('renders RefreshPicker with run button in panel view', function () {
        var container = render(React.createElement(DashNavTimeControls, { dashboard: dashboardModel, onChangeTimeZone: jest.fn(), key: "time-controls" }));
        expect(container.queryByLabelText(/RefreshPicker run button/i)).toBeInTheDocument();
    });
    it('renders RefreshPicker with interval button in panel view', function () {
        var container = render(React.createElement(DashNavTimeControls, { dashboard: dashboardModel, onChangeTimeZone: jest.fn(), key: "time-controls" }));
        expect(container.queryByLabelText(/RefreshPicker interval button/i)).toBeInTheDocument();
    });
    it('should not render RefreshPicker interval button in panel edit', function () {
        var panel = { destroy: jest.fn(), isEditing: true };
        dashboardModel.startRefresh = jest.fn();
        dashboardModel.panelInEdit = panel;
        var container = render(React.createElement(DashNavTimeControls, { dashboard: dashboardModel, onChangeTimeZone: jest.fn(), key: "time-controls" }));
        expect(container.queryByLabelText(/RefreshPicker interval button/i)).not.toBeInTheDocument();
    });
    it('should render RefreshPicker run button in panel edit', function () {
        var panel = { destroy: jest.fn(), isEditing: true };
        dashboardModel.startRefresh = jest.fn();
        dashboardModel.panelInEdit = panel;
        var container = render(React.createElement(DashNavTimeControls, { dashboard: dashboardModel, onChangeTimeZone: jest.fn(), key: "time-controls" }));
        expect(container.queryByLabelText(/RefreshPicker run button/i)).toBeInTheDocument();
    });
});
//# sourceMappingURL=DashNavTimeControls.test.js.map