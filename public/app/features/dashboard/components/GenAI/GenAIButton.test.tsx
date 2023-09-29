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

    it('should renders text ', async () => {
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

  describe('when LLM plugin is properly configured', () => {
    beforeEach(() => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
    });

    it('should renders text ', async () => {
      setup();

      waitFor(async () => expect(await screen.findByText('Auto-generate')).toBeInTheDocument());
    });

    it('should enable the button', async () => {
      setup();
      waitFor(async () => expect(await screen.findByRole('button')).toBeEnabled());
    });

    it.skip('disables the button while generating', async () => {
      const { getByText, getByRole } = setup();
      const generateButton = getByText('Auto-generate');

      // Click the button
      await fireEvent.click(generateButton);

      // The loading text should be visible and the button disabled
      expect(await screen.findByText('Generating')).toBeVisible();
      await waitFor(() => expect(getByRole('button')).toBeDisabled());
    });

    it.skip('handles the response and re-enables the button', async () => {
      const onGenerate = jest.fn();
      setup({ onGenerate, messages: [] });
      const generateButton = await screen.findByRole('button');

      // Click the button
      await fireEvent.click(generateButton);
      await waitFor(() => expect(generateButton).toBeEnabled());
      await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));

      // Wait for the loading state to be resolved
      expect(onGenerate).toHaveBeenCalledTimes(1);
    });

    it.skip('should call the LLM service with the messages configured and the right temperature', async () => {
      const onGenerate = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3 });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(mockedUseOpenAiStreamState.setMessages).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockedUseOpenAiStreamState.setMessages).toHaveBeenCalledWith(messages, expect.any(Function), 3)
      );
    });

    it.skip('should call the onClick callback', async () => {
      const onGenerate = jest.fn();
      const onClick = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onGenerate, messages, temperature: 3, onClick });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
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

    it('should renders error state text', async () => {
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
