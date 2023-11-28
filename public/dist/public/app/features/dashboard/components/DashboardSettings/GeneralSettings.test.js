import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { byRole } from 'testing-library-selector';
import { selectors } from '@grafana/e2e-selectors';
import { setBackendSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from '../../../../store/configureStore';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import { GeneralSettingsUnconnected as GeneralSettings } from './GeneralSettings';
setBackendSrv({
    get: jest.fn().mockResolvedValue([]),
});
const setupTestContext = (options) => {
    const store = configureStore();
    const defaults = {
        dashboard: createDashboardModelFixture({
            title: 'test dashboard title',
            description: 'test dashboard description',
            timepicker: {
                refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
                time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
                collapse: true,
                hidden: false,
            },
            timezone: 'utc',
        }, {
            folderId: 1,
            folderTitle: 'test',
        }),
        updateTimeZone: jest.fn(),
        updateWeekStart: jest.fn(),
        sectionNav: {
            main: { text: 'Dashboard' },
            node: {
                text: 'Settings',
            },
        },
    };
    const props = Object.assign(Object.assign({}, defaults), options);
    const { rerender } = render(React.createElement(GrafanaContext.Provider, { value: getGrafanaContextMock() },
        React.createElement(Provider, { store: store },
            React.createElement(BrowserRouter, null,
                React.createElement(GeneralSettings, Object.assign({}, props))))));
    return { rerender, props };
};
describe('General Settings', () => {
    describe('when component is mounted with timezone', () => {
        it('should render correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            setupTestContext({});
            screen.getByDisplayValue('test dashboard title');
            screen.getByDisplayValue('test dashboard description');
            expect(yield screen.findByTestId(selectors.components.TimeZonePicker.containerV2)).toHaveTextContent('Coordinated Universal Time');
        }));
    });
    describe('when timezone is changed', () => {
        it('should call update function', () => __awaiter(void 0, void 0, void 0, function* () {
            const { props } = setupTestContext({});
            yield userEvent.click(screen.getByTestId(selectors.components.TimeZonePicker.containerV2));
            const timeZonePicker = screen.getByTestId(selectors.components.TimeZonePicker.containerV2);
            yield userEvent.click(byRole('combobox').get(timeZonePicker));
            yield selectOptionInTest(timeZonePicker, 'Browser Time');
            expect(props.updateTimeZone).toHaveBeenCalledWith('browser');
            expect(props.dashboard.timezone).toBe('browser');
        }));
    });
});
//# sourceMappingURL=GeneralSettings.test.js.map