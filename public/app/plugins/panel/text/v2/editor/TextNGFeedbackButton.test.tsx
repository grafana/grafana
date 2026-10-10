import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventBusSrv, type EventBus } from '@grafana/data';
import { getAppEvents, setAppEvents } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { TextPanelFeedbackEvent } from 'app/types/events';

import { FEEDBACK_BUTTON_TEST_ID, TextNGFeedbackButton } from './TextNGFeedbackButton';

let originalAppEvents: EventBus;

beforeEach(() => {
  originalAppEvents = getAppEvents();
  setAppEvents(new EventBusSrv());
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterEach(() => {
  setAppEvents(originalAppEvents);
  setTestFlags({});
});

describe('TextNGFeedbackButton', () => {
  it('publishes a feedback event that setupguide can pick up', async () => {
    const onFeedback = jest.fn();
    getAppEvents().subscribe(TextPanelFeedbackEvent, onFeedback);
    render(<TextNGFeedbackButton />);

    await userEvent.click(screen.getByTestId(FEEDBACK_BUTTON_TEST_ID));

    expect(onFeedback).toHaveBeenCalledTimes(1);
  });

  it('offers no entry point while the new features flag is off', () => {
    setTestFlags({});

    render(<TextNGFeedbackButton />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
