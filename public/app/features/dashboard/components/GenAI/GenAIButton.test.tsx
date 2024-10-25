import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Observable } from 'rxjs';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import { GenAIButton, GenAIButtonProps } from './GenAIButton';
import { StreamStatus, useOpenAIStream } from './hooks';
import { EventTrackingSrc } from './tracking';
import { Role } from './utils';

const mockedUseOpenAiStreamState = {
  messages: [],
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

  function setup(props: GenAIButtonProps = { onGenerate, messages: [], eventTrackingSrc }) {
    return render(<GenAIButton text="Auto-generate" {...props} />);
  }

  describe('when LLM plugin is not configured', () => {
    beforeAll(() => {
      jest.mocked(useOpenAIStream).mockReturnValue({
        messages: [],
        error: undefined,
        streamStatus: StreamStatus.IDLE,
        reply: 'Some completed genereated text',
        setMessages: jest.fn(),
        stopGeneration: jest.fn(),
        value: {
          enabled: false,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should not render anything', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).not.toBeInTheDocument());
    });
  });

  describe('when LLM plugin is properly configured, so it is enabled', () => {
    const setMessagesMock = jest.fn();
    const setShouldStopMock = jest.fn();
    beforeEach(() => {
      setMessagesMock.mockClear();
      setShouldStopMock.mockClear();

      jest.mocked(useOpenAIStream).mockReturnValue({
        messages: [],
        error: undefined,
        streamStatus: StreamStatus.IDLE,
        reply: 'Some completed generated text',
        setMessages: setMessagesMock,
        stopGeneration: setShouldStopMock,
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should render text', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('should send the configured messages', async () => {
      setup({ onGenerate, messages: [{ content: 'Generate X', role: 'system' as Role }], eventTrackingSrc });
      const generateButton = await screen.findByRole('button');

      // Click the button
      await fireEvent.click(generateButton);
      await waitFor(() => expect(generateButton).toBeEnabled());

      // Wait for the loading state to be resolved
      expect(setMessagesMock).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledWith([{ content: 'Generate X', role: 'system' as Role }]);
    });

    it('should call the messages when they are provided as callback', async () => {
      const onGenerate = jest.fn();
      const messages = jest.fn().mockReturnValue([{ content: 'Generate X', role: 'system' as Role }]);
      const onClick = jest.fn();
      setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      expect(messages).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledWith([{ content: 'Generate X', role: 'system' as Role }]);
    });

    it('should call the onClick callback', async () => {
      const onGenerate = jest.fn();
      const onClick = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    });

    it('should display the tooltip if provided', async () => {
      const { getByRole, getByTestId } = setup({
        tooltip: 'This is a tooltip',
        onGenerate,
        messages: [],
        eventTrackingSrc,
      });

      // Wait for the check to be completed
      const button = getByRole('button');
      await userEvent.hover(button);

      const tooltip = await waitFor(() => getByTestId(selectors.components.Tooltip.container));
      expect(tooltip).toBeVisible();
      expect(tooltip).toHaveTextContent('This is a tooltip');
    });
  });

  describe('when it is generating data', () => {
    const setShouldStopMock = jest.fn();

    beforeEach(() => {
      jest.mocked(useOpenAIStream).mockReturnValue({
        messages: [],
        error: undefined,
        streamStatus: StreamStatus.GENERATING,
        reply: 'Some incomplete generated text',
        setMessages: jest.fn(),
        stopGeneration: setShouldStopMock,
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should render loading text', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('shows the stop button while generating', async () => {
      const { getByText, getByRole } = setup();
      const generateButton = getByText('Stop generating');

      expect(generateButton).toBeVisible();
      await waitFor(() => expect(getByRole('button')).toBeEnabled());
    });

    it('should not call onGenerate when the text is generating', async () => {
      const onGenerate = jest.fn();
      setup({ onGenerate, messages: [], eventTrackingSrc: eventTrackingSrc });

      await waitFor(() => expect(onGenerate).not.toHaveBeenCalledTimes(1));
    });

    it('should stop generating when clicking the button', async () => {
      const onGenerate = jest.fn();
      const { getByText } = setup({ onGenerate, messages: [], eventTrackingSrc: eventTrackingSrc });
      const generateButton = getByText('Stop generating');

      await fireEvent.click(generateButton);

      expect(setShouldStopMock).toHaveBeenCalledTimes(1);
      expect(onGenerate).not.toHaveBeenCalled();
    });
  });

  describe('when it is completed from generating data', () => {
    const setShouldStopMock = jest.fn();

    beforeEach(() => {
      const reply = 'Some completed generated text';
      const returnValue = {
        messages: [],
        error: undefined,
        streamStatus: StreamStatus.COMPLETED,
        reply,
        setMessages: jest.fn(),
        stopGeneration: setShouldStopMock,
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      };

      jest
        .mocked(useOpenAIStream)
        .mockImplementationOnce((options) => {
          options?.onResponse?.(reply);
          return returnValue;
        })
        .mockImplementation(() => returnValue);
    });

    it('should render improve text ', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Improve')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('should call onGenerate when the text is completed', async () => {
      const onGenerate = jest.fn();
      setup({ onGenerate, messages: [], eventTrackingSrc: eventTrackingSrc });

      await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
      expect(onGenerate).toHaveBeenCalledWith('Some completed generated text');
    });
  });

  describe('when there is an error generating data', () => {
    const setMessagesMock = jest.fn();
    const setShouldStopMock = jest.fn();
    beforeEach(() => {
      setMessagesMock.mockClear();
      setShouldStopMock.mockClear();

      jest.mocked(useOpenAIStream).mockReturnValue({
        messages: [],
        error: new Error('Something went wrong'),
        streamStatus: StreamStatus.IDLE,
        reply: '',
        setMessages: setMessagesMock,
        stopGeneration: setShouldStopMock,
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should render error state text', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Retry')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('should retry when clicking', async () => {
      const onGenerate = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      const { getByText } = setup({ onGenerate, messages, temperature: 3, eventTrackingSrc });
      const generateButton = getByText('Retry');

      await fireEvent.click(generateButton);

      expect(setMessagesMock).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledWith(messages);
    });

    it('should display the error message as tooltip', async () => {
      const { getByRole, getByTestId } = setup();

      // Wait for the check to be completed
      const button = getByRole('button');
      await userEvent.hover(button);

      const tooltip = await waitFor(() => getByTestId(selectors.components.Tooltip.container));
      expect(tooltip).toBeVisible();

      // The tooltip keeps interactive to be able to click the link
      await userEvent.hover(tooltip);
      expect(tooltip).toBeVisible();
      expect(tooltip).toHaveTextContent(
        'Failed to generate content using OpenAI. Please try again or if the problem persists, contact your organization admin.'
      );
    });

    it('error message should overwrite the tooltip content passed in tooltip prop', async () => {
      const { getByRole, getByTestId } = setup({
        tooltip: 'This is a tooltip',
        onGenerate,
        messages: [],
        eventTrackingSrc,
      });

      // Wait for the check to be completed
      const button = getByRole('button');
      await userEvent.hover(button);

      const tooltip = await waitFor(() => getByTestId(selectors.components.Tooltip.container));
      expect(tooltip).toBeVisible();

      // The tooltip keeps interactive to be able to click the link
      await userEvent.hover(tooltip);
      expect(tooltip).toBeVisible();
      expect(tooltip).toHaveTextContent(
        'Failed to generate content using OpenAI. Please try again or if the problem persists, contact your organization admin.'
      );
    });

    it('should call the onClick callback', async () => {
      const onGenerate = jest.fn();
      const onClick = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    });

    it('should call the messages when they are provided as callback', async () => {
      const onGenerate = jest.fn();
      const messages = jest.fn().mockReturnValue([{ content: 'Generate X', role: 'system' as Role }]);
      const onClick = jest.fn();
      setup({ onGenerate, messages, temperature: 3, onClick, eventTrackingSrc });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      expect(messages).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledWith([{ content: 'Generate X', role: 'system' as Role }]);
    });
  });
});
