/* eslint-disable @typescript-eslint/no-explicit-any */
import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { getUpdateStatus } from '../UpdatePanel.service';
import { useInitializeUpdate, usePerformUpdate } from '../hooks';
const fakeLaunchUpdate = jest.fn();
const HookWrapper = () => {
    const [output, errorMessage, isUpdated, updateFailed, launchUpdate] = usePerformUpdate();
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { "data-testid": "hook-wrapper-output" }, output),
        React.createElement("span", { "data-testid": "hook-wrapper-error" }, errorMessage),
        isUpdated && React.createElement("span", { "data-testid": "hook-wrapper-updated" }),
        updateFailed && React.createElement("span", { "data-testid": "hook-wrapper-update-failed" }),
        React.createElement("button", { "data-testid": "hook-wrapper-update", onClick: launchUpdate })));
};
// NOTE (nicolalamacchia): these mocks are here because some test cases alter them
jest.mock('./useInitializeUpdate', () => ({
    useInitializeUpdate: jest.fn(),
}));
const mockedUseInitializeUpdate = useInitializeUpdate;
jest.mock('../UpdatePanel.service', () => ({
    getUpdateStatus: jest.fn(),
}));
const mockedGetUpdateStatus = getUpdateStatus;
describe('usePerformUpdate', () => {
    beforeEach(() => {
        // default mocks
        mockedUseInitializeUpdate.mockImplementation(() => ['authToken', 0, false, fakeLaunchUpdate]);
        mockedGetUpdateStatus.mockImplementation(() => ({
            done: false,
            log_offset: 0,
            log_lines: ['test'],
        }));
    });
    afterEach(() => {
        mockedUseInitializeUpdate.mockRestore();
        mockedGetUpdateStatus.mockRestore();
    });
    it('should return the correct values if the upgrade initialization was successful', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(HookWrapper, null));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\n'));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
        fireEvent.click(screen.getByTestId('hook-wrapper-update'));
        expect(fakeLaunchUpdate).toBeCalledTimes(1);
    }));
    it('should return updateFailed equal to true if the initialization failed', () => __awaiter(void 0, void 0, void 0, function* () {
        mockedUseInitializeUpdate.mockImplementation(() => ['authToken', 0, true, fakeLaunchUpdate]);
        render(React.createElement(HookWrapper, null));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe(''));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).toBeInTheDocument());
    }));
    it('should return isUpdated equal to true if the upgrade succeeded', () => __awaiter(void 0, void 0, void 0, function* () {
        getUpdateStatus.mockImplementation(() => ({
            done: true,
            log_offset: 0,
            log_lines: ['test'],
        }));
        jest.useFakeTimers();
        render(React.createElement(HookWrapper, null));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            jest.runAllTimers();
        }));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\n'));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
        jest.useRealTimers();
    }));
    it('should return an error message if the API call response is invalid', () => __awaiter(void 0, void 0, void 0, function* () {
        getUpdateStatus.mockImplementation(() => { });
        render(React.createElement(HookWrapper, null));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe(''));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe('Invalid response received'));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
    }));
    it('should increase logOffset value only with values received from server', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockedGetUpdateStatus = getUpdateStatus;
        mockedGetUpdateStatus
            .mockImplementationOnce(() => ({
            done: false,
            log_offset: 1500,
            log_lines: ['test'],
        }))
            .mockImplementationOnce(() => ({
            done: false,
            log_offset: 3000,
            log_lines: ['test'],
        }))
            .mockImplementationOnce(() => ({
            done: false,
            log_offset: 6000,
            log_lines: ['test'],
        }));
        jest.useFakeTimers();
        render(React.createElement(HookWrapper, null));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            jest.runAllTimers();
        }));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            jest.runAllTimers();
        }));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\ntest\ntest\n'));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
        jest.useRealTimers();
    }));
});
//# sourceMappingURL=usePerformUpdate.test.js.map