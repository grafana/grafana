import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';
import { byRole } from 'testing-library-selector';
import { GeneralSettingsUnconnected as GeneralSettings } from './GeneralSettings';
var setupTestContext = function (options) {
    var defaults = {
        dashboard: {
            title: 'test dashboard title',
            description: 'test dashboard description',
            timepicker: {
                refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
                time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
            },
            meta: {
                folderId: 1,
                folderTitle: 'test',
            },
            timezone: 'utc',
        },
        updateTimeZone: jest.fn(),
        updateWeekStart: jest.fn(),
    };
    var props = __assign(__assign({}, defaults), options);
    var rerender = render(React.createElement(GeneralSettings, __assign({}, props))).rerender;
    return { rerender: rerender, props: props };
};
describe('General Settings', function () {
    describe('when component is mounted with timezone', function () {
        it('should render correctly', function () {
            setupTestContext({});
            screen.getByDisplayValue('test dashboard title');
            screen.getByDisplayValue('test dashboard description');
            expect(screen.getByLabelText('Time zone picker select container')).toHaveTextContent('Coordinated Universal Time');
        });
    });
    describe('when timezone is changed', function () {
        it('should call update function', function () { return __awaiter(void 0, void 0, void 0, function () {
            var props, timeZonePicker;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        props = setupTestContext({}).props;
                        userEvent.click(screen.getByLabelText('Time zone picker select container'));
                        timeZonePicker = screen.getByLabelText('Time zone picker select container');
                        userEvent.click(byRole('textbox').get(timeZonePicker));
                        return [4 /*yield*/, selectOptionInTest(timeZonePicker, 'Browser Time')];
                    case 1:
                        _a.sent();
                        expect(props.updateTimeZone).toHaveBeenCalledWith('browser');
                        expect(props.dashboard.timezone).toBe('browser');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=GeneralSettings.test.js.map