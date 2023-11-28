import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { startUpdate } from '../UpdatePanel.service';
import { useInitializeUpdate } from './useInitializeUpdate';
const HookWrapper = () => {
    const [authToken, logOffset, updateFailed, initializeUpdate] = useInitializeUpdate();
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { "data-testid": "hook-wrapper-token" }, authToken),
        React.createElement("span", { "data-testid": "hook-wrapper-offset" }, logOffset),
        updateFailed && React.createElement("span", { "data-testid": "hook-wrapper-update-failed" }),
        React.createElement("button", { "data-testid": "hook-wrapper-update", onClick: initializeUpdate })));
};
// NOTE (nicolalamacchia): this mock is here because some test cases alter it
jest.mock('../UpdatePanel.service', () => ({
    startUpdate: jest.fn(),
}));
const mockedStartUpdate = startUpdate;
const originalConsoleError = jest.fn();
describe('useInitializeUpdate', () => {
    beforeEach(() => {
        // default mock
        mockedStartUpdate.mockImplementation(() => ({
            auth_token: 'test',
            log_offset: 1337,
        }));
        console.error = jest.fn();
    });
    afterEach(() => {
        mockedStartUpdate.mockRestore();
        console.error = originalConsoleError;
    });
    it('should return the correct values if the api call is pending', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(HookWrapper, null));
        expect(screen.getByTestId('hook-wrapper-token').textContent).toBe('');
        expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('0');
        expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('hook-wrapper-update'));
        expect(mockedStartUpdate).toBeCalledTimes(1);
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-token').textContent).toBe('test'));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('1337'));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
    }));
    it('should return updateFailed equal to true if the the API call response was invalid', () => __awaiter(void 0, void 0, void 0, function* () {
        mockedStartUpdate.mockImplementation(() => null);
        render(React.createElement(HookWrapper, null));
        fireEvent.click(screen.getByTestId('hook-wrapper-update'));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-token').textContent).toBe(''));
        yield waitFor(() => expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('0'));
        yield waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).toBeInTheDocument());
    }));
});
//# sourceMappingURL=useInitializeUpdate.test.js.map