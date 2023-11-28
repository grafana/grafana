import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useRecurringCall } from './recurringCall.hook';
let fakeCallback;
const TIMEOUT_TIME = 5000;
const CHANGED_TIMEOUT_TIME = 20000;
const Dummy = () => {
    const [triggerTimeout, changeInterval, stopTimeout] = useRecurringCall();
    return (React.createElement(React.Fragment, null,
        React.createElement("button", { onClick: () => triggerTimeout(fakeCallback, TIMEOUT_TIME, true) }),
        React.createElement("button", { onClick: () => stopTimeout() }),
        React.createElement("button", { onClick: () => changeInterval(CHANGED_TIMEOUT_TIME) })));
};
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('useRecurringCall', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        fakeCallback = jest.fn();
    });
    it('should invoke the callback immediately if flag passed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(1);
    }));
    it('should invoke the callback recursively', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(4);
    }));
    it('should clear timeout on unmount', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(window, 'clearTimeout').mockImplementationOnce((args) => clearTimeout(args));
        const wrapper = render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        expect(spy).not.toHaveBeenCalled();
        wrapper.unmount();
        expect(spy).toHaveBeenCalled();
    }));
    it('should keep timeout on error', () => __awaiter(void 0, void 0, void 0, function* () {
        fakeCallback.mockImplementationOnce(() => {
            throw new Error();
        });
        render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(4);
    }));
    it('should stop timeout flow', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        fireEvent.click(screen.getAllByRole('button')[1]);
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(1);
    }));
    it('should change interval', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Dummy, null));
        fireEvent.click(screen.getAllByRole('button')[0]);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getAllByRole('button')[2]);
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        jest.advanceTimersByTime(5000);
        yield Promise.resolve();
        expect(fakeCallback).toHaveBeenCalledTimes(2);
    }));
});
//# sourceMappingURL=recurringCall.hook.test.js.map