import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getDefaultTimeRange, systemDateFormats } from '@grafana/data';
import { TimePickerWithHistory } from './TimePickerWithHistory';
describe('TimePickerWithHistory', () => {
    // In some of the tests we close and re-open the picker. When we do that we must re-find these inputs
    // as new elements will have been mounted
    const getFromField = () => screen.getByLabelText('Time Range from field');
    const getToField = () => screen.getByLabelText('Time Range to field');
    const getApplyButton = () => screen.getByRole('button', { name: 'Apply time range' });
    const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
    const OLD_LOCAL_STORAGE = [
        {
            from: '2022-12-03T00:00:00.000Z',
            to: '2022-12-03T23:59:59.000Z',
            raw: { from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' },
        },
        {
            from: '2022-12-02T00:00:00.000Z',
            to: '2022-12-02T23:59:59.000Z',
            raw: { from: '2022-12-02T00:00:00.000Z', to: '2022-12-02T23:59:59.000Z' },
        },
    ];
    const NEW_LOCAL_STORAGE = [
        { from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' },
        { from: '2022-12-02T00:00:00.000Z', to: '2022-12-02T23:59:59.000Z' },
    ];
    const props = {
        timeZone: 'utc',
        onChange: () => { },
        onChangeTimeZone: () => { },
        onMoveBackward: () => { },
        onMoveForward: () => { },
        onZoom: () => { },
    };
    afterEach(() => {
        window.localStorage.clear();
    });
    it('Should load with no history', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        expect(screen.getByText(/It looks like you haven't used this time picker before/i)).toBeInTheDocument();
    }));
    it('Should load with old TimeRange history', () => __awaiter(void 0, void 0, void 0, function* () {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(OLD_LOCAL_STORAGE));
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        expect(screen.getByText(/2022-12-03 00:00:00 to 2022-12-03 23:59:59/i)).toBeInTheDocument();
        expect(screen.queryByText(/2022-12-02 00:00:00 to 2022-12-02 23:59:59/i)).toBeInTheDocument();
    }));
    it('Should load with new TimePickerHistoryItem history', () => __awaiter(void 0, void 0, void 0, function* () {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(NEW_LOCAL_STORAGE));
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        expect(screen.queryByText(/2022-12-03 00:00:00 to 2022-12-03 23:59:59/i)).toBeInTheDocument();
        expect(screen.queryByText(/2022-12-02 00:00:00 to 2022-12-02 23:59:59/i)).toBeInTheDocument();
    }));
    it('Saves changes into local storage without duplicates', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        yield clearAndType(getFromField(), '2022-12-03 00:00:00');
        yield clearAndType(getToField(), '2022-12-03 23:59:59');
        yield userEvent.click(getApplyButton());
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        // Same range again!
        yield clearAndType(getFromField(), '2022-12-03 00:00:00');
        yield clearAndType(getToField(), '2022-12-03 23:59:59');
        yield userEvent.click(getApplyButton());
        const newLsValue = JSON.parse((_a = window.localStorage.getItem(LOCAL_STORAGE_KEY)) !== null && _a !== void 0 ? _a : '[]');
        expect(newLsValue).toEqual([{ from: '2022-12-03T00:00:00.000Z', to: '2022-12-03T23:59:59.000Z' }]);
    }));
    it('Should show 4 most recently used time ranges', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const inputRanges = [
            ['2022-12-10 00:00:00', '2022-12-10 23:59:59'],
            ['2022-12-11 00:00:00', '2022-12-11 23:59:59'],
            ['2022-12-12 00:00:00', '2022-12-12 23:59:59'],
            ['2022-12-13 00:00:00', '2022-12-13 23:59:59'],
            ['2022-12-14 00:00:00', '2022-12-14 23:59:59'],
        ];
        const expectedLocalStorage = [
            { from: '2022-12-14T00:00:00.000Z', to: '2022-12-14T23:59:59.000Z' },
            { from: '2022-12-13T00:00:00.000Z', to: '2022-12-13T23:59:59.000Z' },
            { from: '2022-12-12T00:00:00.000Z', to: '2022-12-12T23:59:59.000Z' },
            { from: '2022-12-11T00:00:00.000Z', to: '2022-12-11T23:59:59.000Z' },
        ];
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        for (const [inputFrom, inputTo] of inputRanges) {
            yield userEvent.click(screen.getByLabelText(/Time range selected/));
            yield clearAndType(getFromField(), inputFrom);
            yield clearAndType(getToField(), inputTo);
            yield userEvent.click(getApplyButton());
        }
        const newLsValue = JSON.parse((_b = window.localStorage.getItem(LOCAL_STORAGE_KEY)) !== null && _b !== void 0 ? _b : '[]');
        expect(newLsValue).toEqual(expectedLocalStorage);
    }));
    it('Should display handle timezones correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeRange = getDefaultTimeRange();
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props, { timeZone: 'Asia/Tokyo' })));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        yield clearAndType(getFromField(), '2022-12-10 00:00:00');
        yield clearAndType(getToField(), '2022-12-10 23:59:59');
        yield userEvent.click(getApplyButton());
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        expect(screen.getByText(/2022-12-10 00:00:00 to 2022-12-10 23:59:59/i)).toBeInTheDocument();
    }));
    it('Should display history correctly with custom time format', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeRange = getDefaultTimeRange();
        const interval = {
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'DD-MM HH:mm',
            day: 'DD-MM',
            month: 'MM-YYYY',
            year: 'YYYY',
        };
        systemDateFormats.update({
            fullDate: 'DD-MM-YYYY HH:mm:ss',
            interval: interval,
            useBrowserLocale: false,
        });
        render(React.createElement(TimePickerWithHistory, Object.assign({ value: timeRange }, props)));
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        yield clearAndType(getFromField(), '03-12-2022 00:00:00');
        yield clearAndType(getToField(), '03-12-2022 23:59:59');
        yield userEvent.click(getApplyButton());
        yield userEvent.click(screen.getByLabelText(/Time range selected/));
        expect(screen.getByText(/03-12-2022 00:00:00 to 03-12-2022 23:59:59/i)).toBeInTheDocument();
    }));
});
function clearAndType(field, text) {
    return __awaiter(this, void 0, void 0, function* () {
        yield userEvent.clear(field);
        return yield userEvent.type(field, text);
    });
}
//# sourceMappingURL=TimePickerWithHistory.test.js.map