import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Router } from 'react-router-dom';
import { Subscription } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';

import { GenAIButton, GenAIButtonProps } from './GenAIButton';
import { isLLMPluginEnabled, generateTextWithLLM, Role } from './utils';

jest.mock('./utils', () => ({
  generateTextWithLLM: jest.fn(),
  isLLMPluginEnabled: jest.fn(),
}));

describe('GenAIButton', () => {
  const onReply = jest.fn();

  function setup(props: GenAIButtonProps = { onReply, messages: [] }) {
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
      jest.resetAllMocks();
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

    it('disables the button while generating', async () => {
      const isDoneGeneratingMessage = false;
      jest.mocked(generateTextWithLLM).mockImplementationOnce((messages = [], replyHandler) => {
        replyHandler('Generated text', isDoneGeneratingMessage);
        return new Promise(() => new Subscription());
      });

      const { getByText, getByRole } = setup();
      const generateButton = getByText('Auto-generate');

      // Click the button
      await fireEvent.click(generateButton);

      // The loading text should be visible and the button disabled
      expect(await screen.findByText('Generating')).toBeVisible();
      await waitFor(() => expect(getByRole('button')).toBeDisabled());
    });

    it('handles the response and re-enables the button', async () => {
      const isDoneGeneratingMessage = true;
      jest.mocked(generateTextWithLLM).mockImplementationOnce((messages = [], replyHandler) => {
        replyHandler('Generated text', isDoneGeneratingMessage);
        return new Promise(() => new Subscription());
      });
      const onReply = jest.fn();
      setup({ onReply, messages: [] });
      const generateButton = await screen.findByRole('button');

      // Click the button
      await fireEvent.click(generateButton);
      await waitFor(() => expect(generateButton).toBeEnabled());
      await waitFor(() => expect(onReply).toHaveBeenCalledTimes(1));

      // Wait for the loading state to be resolved
      expect(onReply).toHaveBeenCalledTimes(1);
    });

    it('should call the LLM service with the messages configured', async () => {
      const onReply = jest.fn();
      const messages = [{ content: 'Generate X', role: 'system' as Role }];
      setup({ onReply, messages });

      const generateButton = await screen.findByRole('button');
      await fireEvent.click(generateButton);

      await waitFor(() => expect(generateTextWithLLM).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(generateTextWithLLM).toHaveBeenCalledWith(messages, expect.any(Function)));
    });
  });
});
