import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Router } from 'react-router-dom';
import { Observable } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';

import { GenAIButton, GenAIButtonProps } from './GenAIButton';
import { useOpenAIStream } from './hooks';
import { Role, isLLMPluginEnabled } from './utils';

jest.mock('./utils', () => ({
  isLLMPluginEnabled: jest.fn(),
}));

const mockedUseOpenAiStreamState = {
  setMessages: jest.fn(),
  reply: 'I am a robot',
  isGenerationResponse: false,
  error: null,
  value: null,
};

jest.mock('./hooks', () => ({
  useOpenAIStream: jest.fn(() => mockedUseOpenAiStreamState),
}));

describe('GenAIButton', () => {
  const onGenerate = jest.fn();

  function setup(props: GenAIButtonProps = { onGenerate, messages: [] }) {
    return render(
      <Router history={locationService.getHistory()}>
        <GenAIButton text="Auto-generate" {...props} />
      </Router>
    );
  }

  describe('when LLM plugin is not configured', () => {
    beforeAll(() => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(false);
    });

    it('should render text ', async () => {
      const { getByText } = setup();
      waitFor(() => expect(getByText('Auto-generate')).toBeInTheDocument());
    });

    it('should disable the button', async () => {
      const { getByRole } = setup();
      waitFor(() => expect(getByRole('button')).toBeDisabled());
    });

    it('should display an error message when hovering', async () => {
      const { getByRole, getByTestId } = setup();

      // Wait for the check to be completed
      const button = getByRole('button');
      await waitFor(() => expect(button).toBeDisabled());
      await userEvent.hover(button);

      const tooltip = await waitFor(() => getByTestId(selectors.components.Tooltip.container));
      expect(tooltip).toBeVisible();

      // The tooltip keeps interactive to be able to click the link
      await userEvent.hover(tooltip);
      expect(tooltip).toBeVisible();
    });
  });

  describe('when LLM plugin is properly configured, so it is enabled', () => {
    const setMessagesMock = jest.fn();
    beforeEach(() => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
      jest.mocked(useOpenAIStream).mockReturnValue({
        error: undefined,
        isGenerating: false,
        reply: 'Some completed genereated text',
        setMessages: setMessagesMock,
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should render text ', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('should send the configured messages', async () => {
      setup({ onGenerate, messages: [{ content: 'Generate X', role: 'system' as Role }] });
      const generateButton = await screen.findByRole('button');

      // Click the button
      await fireEvent.click(generateButton);
      await waitFor(() => expect(generateButton).toBeEnabled());

      // Wait for the loading state to be resolved
      expect(setMessagesMock).toHaveBeenCalledTimes(1);
      expect(setMessagesMock).toHaveBeenCalledWith([{ content: 'Generate X', role: 'system' as Role }]);
    });

    it('should call the onClick callback', async () => {
      const onGenerate = jest.fn();
      const onClick = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3, onClick });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    });
  });

  describe('when it is generating data', () => {
    beforeEach(() => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
      jest.mocked(useOpenAIStream).mockReturnValue({
        error: undefined,
        isGenerating: true,
        reply: 'Some incompleted generated text',
        setMessages: jest.fn(),
        value: {
          enabled: true,
          stream: new Observable().subscribe(),
        },
      });
    });

    it('should render loading text ', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it('disables the button while generating', async () => {
      const { getByText, getByRole } = setup();
      const generateButton = getByText('Generating');

      // The loading text should be visible and the button disabled
      expect(generateButton).toBeVisible();
      await waitFor(() => expect(getByRole('button')).toBeDisabled());
    });

    it('should call onGenerate when the text is generating', async () => {
      const onGenerate = jest.fn();
      setup({ onGenerate, messages: [] });

      await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));

      expect(onGenerate).toHaveBeenCalledWith('Some incompleted generated text');
    });
  });

  describe('when there is an error generating data', () => {
    const setMessagesMock = jest.fn();
    beforeEach(() => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
      jest.mocked(useOpenAIStream).mockReturnValue({
        error: new Error('Something went wrong'),
        isGenerating: false,
        reply: '',
        setMessages: setMessagesMock,
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
      const { getByText } = setup({ onGenerate, messages, temperature: 3 });
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
      expect(tooltip).toHaveTextContent('Something went wrong');
    });

    it('should call the onClick callback', async () => {
      const onGenerate = jest.fn();
      const onClick = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3, onClick });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
    });
  });
});
