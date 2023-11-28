import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Router } from 'react-router-dom';
import { Observable } from 'rxjs';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { GenAIButton } from './GenAIButton';
import { StreamStatus, useOpenAIStream } from './hooks';
import { EventTrackingSrc } from './tracking';
const mockedUseOpenAiStreamState = {
    setMessages: jest.fn(),
    reply: 'I am a robot',
    streamStatus: StreamStatus.IDLE,
    error: null,
    value: null,
};
jest.mock('./hooks', () => ({
    useOpenAIStream: jest.fn(() => mockedUseOpenAiStreamState),
    StreamStatus: {
        IDLE: 'idle',
        GENERATING: 'generating',
    },
}));
describe('GenAIButton', () => {
    const onGenerate = jest.fn();
    const eventTrackingSrc = EventTrackingSrc.unknown;
    function setup(props = { onGenerate, messages: [], eventTrackingSrc }) {
        return render(React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(GenAIButton, Object.assign({ text: "Auto-generate" }, props))));
    }
    describe('when LLM plugin is not configured', () => {
        beforeAll(() => {
            jest.mocked(useOpenAIStream).mockReturnValue({
                error: undefined,
                streamStatus: StreamStatus.IDLE,
                reply: 'Some completed genereated text',
                setMessages: jest.fn(),
                value: {
                    enabled: false,
                    stream: new Observable().subscribe(),
                },
            });
        });
        it('should not render anything', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByText('Auto-generate')).not.toBeInTheDocument(); }));
        }));
    });
    describe('when LLM plugin is properly configured, so it is enabled', () => {
        const setMessagesMock = jest.fn();
        beforeEach(() => {
            jest.mocked(useOpenAIStream).mockReturnValue({
                error: undefined,
                streamStatus: StreamStatus.IDLE,
                reply: 'Some completed genereated text',
                setMessages: setMessagesMock,
                value: {
                    enabled: true,
                    stream: new Observable().subscribe(),
                },
            });
        });
        it('should render text ', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByText('Auto-generate')).toBeInTheDocument(); }));
        }));
        it('should enable the button', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByRole('button')).toBeEnabled(); }));
        }));
        it('should send the configured messages', () => __awaiter(void 0, void 0, void 0, function* () {
            setup({ onGenerate, messages: [{ content: 'Generate X', role: 'system' }], eventTrackingSrc });
            const generateButton = yield screen.findByRole('button');
            // Click the button
            yield fireEvent.click(generateButton);
            yield waitFor(() => expect(generateButton).toBeEnabled());
            // Wait for the loading state to be resolved
            expect(setMessagesMock).toHaveBeenCalledTimes(1);
            expect(setMessagesMock).toHaveBeenCalledWith([{ content: 'Generate X', role: 'system' }]);
        }));
        it('should call the onClick callback', () => __awaiter(void 0, void 0, void 0, function* () {
            const onGenerate = jest.fn();
            const onClick = jest.fn();
            const messages = [{ content: 'Generate X', role: 'system' }];
            setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });
            const generateButton = yield screen.findByRole('button');
            yield fireEvent.click(generateButton);
            yield waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
        }));
    });
    describe('when it is generating data', () => {
        beforeEach(() => {
            jest.mocked(useOpenAIStream).mockReturnValue({
                error: undefined,
                streamStatus: StreamStatus.GENERATING,
                reply: 'Some incomplete generated text',
                setMessages: jest.fn(),
                value: {
                    enabled: true,
                    stream: new Observable().subscribe(),
                },
            });
        });
        it('should render loading text ', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByText('Auto-generate')).toBeInTheDocument(); }));
        }));
        it('should enable the button', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByRole('button')).toBeEnabled(); }));
        }));
        it('disables the button while generating', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getByText, getByRole } = setup();
            const generateButton = getByText('Generating');
            // The loading text should be visible and the button disabled
            expect(generateButton).toBeVisible();
            yield waitFor(() => expect(getByRole('button')).toBeDisabled());
        }));
        it('should call onGenerate when the text is generating', () => __awaiter(void 0, void 0, void 0, function* () {
            const onGenerate = jest.fn();
            setup({ onGenerate, messages: [], eventTrackingSrc: eventTrackingSrc });
            yield waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
            expect(onGenerate).toHaveBeenCalledWith('Some incomplete generated text');
        }));
    });
    describe('when there is an error generating data', () => {
        const setMessagesMock = jest.fn();
        beforeEach(() => {
            jest.mocked(useOpenAIStream).mockReturnValue({
                error: new Error('Something went wrong'),
                streamStatus: StreamStatus.IDLE,
                reply: '',
                setMessages: setMessagesMock,
                value: {
                    enabled: true,
                    stream: new Observable().subscribe(),
                },
            });
        });
        it('should render error state text', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByText('Retry')).toBeInTheDocument(); }));
        }));
        it('should enable the button', () => __awaiter(void 0, void 0, void 0, function* () {
            setup();
            waitFor(() => __awaiter(void 0, void 0, void 0, function* () { return expect(yield screen.findByRole('button')).toBeEnabled(); }));
        }));
        it('should retry when clicking', () => __awaiter(void 0, void 0, void 0, function* () {
            const onGenerate = jest.fn();
            const messages = [{ content: 'Generate X', role: 'system' }];
            const { getByText } = setup({ onGenerate, messages, temperature: 3, eventTrackingSrc });
            const generateButton = getByText('Retry');
            yield fireEvent.click(generateButton);
            expect(setMessagesMock).toHaveBeenCalledTimes(1);
            expect(setMessagesMock).toHaveBeenCalledWith(messages);
        }));
        it('should display the error message as tooltip', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getByRole, getByTestId } = setup();
            // Wait for the check to be completed
            const button = getByRole('button');
            yield userEvent.hover(button);
            const tooltip = yield waitFor(() => getByTestId(selectors.components.Tooltip.container));
            expect(tooltip).toBeVisible();
            // The tooltip keeps interactive to be able to click the link
            yield userEvent.hover(tooltip);
            expect(tooltip).toBeVisible();
            expect(tooltip).toHaveTextContent('Failed to generate content using OpenAI. Please try again or if the problem persist, contact your organization admin.');
        }));
        it('should call the onClick callback', () => __awaiter(void 0, void 0, void 0, function* () {
            const onGenerate = jest.fn();
            const onClick = jest.fn();
            const messages = [{ content: 'Generate X', role: 'system' }];
            setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });
            const generateButton = yield screen.findByRole('button');
            yield fireEvent.click(generateButton);
            yield waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
        }));
    });
});
//# sourceMappingURL=GenAIButton.test.js.map