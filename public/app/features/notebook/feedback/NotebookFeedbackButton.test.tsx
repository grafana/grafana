import { render, screen } from 'test/test-utils';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_FEEDBACK_RATING, NOTEBOOK_FEEDBACK_REASON } from '../analytics/types';

import { NotebookFeedbackButton } from './NotebookFeedbackButton';

const mockSuccess = jest.fn();

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({ success: mockSuccess }),
}));

describe('NotebookFeedbackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records what worked well without sending notebook content', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton />);

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
      '  The charts are useful  '
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSuccess).toHaveBeenCalledWith('Thanks for your feedback');
  });

  it('requires a reason for negative feedback', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton />);

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
      ''
    );
  });

  it('accepts written negative feedback without a reason chip', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Could be better' }));
    await user.type(screen.getByRole('textbox', { name: 'Tell us more (optional)' }), 'Unable to save changes');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(
      NOTEBOOK_FEEDBACK_RATING.COULD_BE_BETTER,
      [],
      'Unable to save changes'
    );
  });

  it('clears reasons when switching ratings', async () => {
    const feedbackSubmitted = jest.spyOn(NotebookAnalytics, 'feedbackSubmitted').mockImplementation();
    const { user } = render(<NotebookFeedbackButton />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('button', { name: 'Could be better' }));
    await user.click(screen.getByRole('button', { name: 'Editing' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    expect(feedbackSubmitted).toHaveBeenCalledWith(NOTEBOOK_FEEDBACK_RATING.GOOD, [], '');
  });
});
