import { act, render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_FEEDBACK_RATING, NOTEBOOK_FEEDBACK_REASON, NOTEBOOK_FEEDBACK_SOURCE } from '../analytics/types';

import { NotebookFeedbackButton } from './NotebookFeedbackButton';
import { NotebookFeedbackFormRequestEvent, NotebookFeedbackFormStateEvent } from './notebookFeedbackFormEvents';

const mockSuccess = jest.fn();

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({ success: mockSuccess }),
}));

describe('NotebookFeedbackButton', () => {
  const originalWriteKey = config.rudderstackWriteKey;
  const originalDataPlaneUrl = config.rudderstackDataPlaneUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    config.rudderstackWriteKey = 'test-key';
    config.rudderstackDataPlaneUrl = 'https://example.com';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    config.rudderstackWriteKey = originalWriteKey;
    config.rudderstackDataPlaneUrl = originalDataPlaneUrl;
  });

  it('hides the form when no feedback collector is configured', () => {
    config.rudderstackWriteKey = undefined;
    render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    expect(screen.queryByRole('button', { name: 'Give feedback' })).not.toBeInTheDocument();
  });

  it('uses the same selector for labeled and toolbar actions', () => {
    const { rerender } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);
    expect(screen.getByTestId(selectors.components.NotebookFeedback.button)).toBeInTheDocument();

    rerender(<NotebookFeedbackButton labeled source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_LIST} />);
    expect(screen.getByTestId(selectors.components.NotebookFeedback.button)).toBeInTheDocument();
  });

  it('records what worked well without sending notebook content', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    expect(screen.getByRole('dialog', { name: 'Tell us about your experience with notebooks' })).toBeInTheDocument();
    expect(screen.queryByText('Your feedback helps us improve notebooks.')).not.toBeInTheDocument();
    expect(screen.queryByText('Notebook content and queries are not attached.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(screen.getByText('What do you like?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tell us more (optional)' })).not.toHaveAttribute('placeholder');
    await user.click(screen.getByRole('button', { name: 'Visualizations' }));
    await user.type(screen.getByRole('textbox', { name: 'Tell us more (optional)' }), '  The charts are useful  ');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(
      NOTEBOOK_FEEDBACK_RATING.GOOD,
      [NOTEBOOK_FEEDBACK_REASON.VISUALIZATIONS],
      '  The charts are useful  ',
      NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSuccess).toHaveBeenCalledWith('Thanks for your feedback');
  });

  it('requires a reason for negative feedback', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Could be better' }));
    expect(screen.getByRole('textbox', { name: 'Tell us more (optional)' })).not.toHaveAttribute('placeholder');
    const sendButton = screen.getByRole('button', { name: 'Send feedback' });
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    await user.hover(sendButton);
    expect(await screen.findByText('Select a topic or add a comment.')).toBeInTheDocument();
    await user.click(sendButton);
    expect(feedbackSubmitted).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Editing' }));
    await user.click(screen.getByRole('button', { name: 'Something is broken' }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(
      NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER,
      [NOTEBOOK_FEEDBACK_REASON.EDITING, NOTEBOOK_FEEDBACK_REASON.SOMETHING_BROKEN],
      '',
      NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR
    );
  });

  it('accepts written negative feedback without a reason chip', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Could be better' }));
    await user.type(screen.getByRole('textbox', { name: 'Tell us more (optional)' }), 'Unable to save changes');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(
      NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER,
      [],
      'Unable to save changes',
      NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR
    );
  });

  it('clears reasons when switching ratings', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Could be better' }));
    await user.click(screen.getByRole('button', { name: 'Editing' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(
      NOTEBOOK_FEEDBACK_RATING.GOOD,
      [],
      '',
      NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR
    );
  });

  it('opens the same form when requested by the feedback nudge', async () => {
    render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);

    act(() => appEvents.publish(new NotebookFeedbackFormRequestEvent({ action: 'open' })));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give feedback' })).toBeInTheDocument();
  });

  it('answers availability checks and reports when the form is open', async () => {
    render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);
    const states: string[] = [];
    const subscription = appEvents.subscribe(NotebookFeedbackFormStateEvent, ({ payload }) =>
      states.push(payload.state)
    );

    act(() => appEvents.publish(new NotebookFeedbackFormRequestEvent({ action: 'status' })));
    expect(states.at(-1)).toBe('available');

    act(() => appEvents.publish(new NotebookFeedbackFormRequestEvent({ action: 'open' })));
    expect(states.at(-1)).toBe('open');
    subscription.unsubscribe();
  });

  it('stops nudges only after submission, not when the form is cancelled', async () => {
    jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton source={NOTEBOOK_FEEDBACK_SOURCE.NOTEBOOK_TOOLBAR} />);
    const states: string[] = [];
    const subscription = appEvents.subscribe(NotebookFeedbackFormStateEvent, ({ payload }) =>
      states.push(payload.state)
    );

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(states).not.toContain('submitted');
    expect(states.at(-1)).toBe('available');

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(states.filter((state) => state === 'submitted')).toHaveLength(1);
    subscription.unsubscribe();
  });
});
