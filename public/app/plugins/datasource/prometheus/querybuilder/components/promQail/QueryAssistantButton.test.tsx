import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { QueryAssistantButton } from './QueryAssistantButton';

const setShowDrawer = jest.fn(() => {});

describe('QueryAssistantButton', () => {
  it('renders the button', async () => {
    const props = createProps(true, 'metric', setShowDrawer);
    render(<QueryAssistantButton {...props} />);
    expect(screen.getByText('Get query suggestions')).toBeInTheDocument();
  });

  it('shows the LLM app disabled message when LLM app is not set up with vector DB', async () => {
    const props = createProps(false, 'metric', setShowDrawer);
    render(<QueryAssistantButton {...props} />);
    const button = screen.getByText('Get query suggestions');
    await userEvent.hover(button);
    await waitFor(() => {
      expect(screen.getByText('Install and enable the LLM plugin')).toBeInTheDocument();
    });
  });

  it('shows the message to select a metric when LLM is enabled and no metric is selected', async () => {
    const props = createProps(true, '', setShowDrawer);
    render(<QueryAssistantButton {...props} />);
    const button = screen.getByText('Get query suggestions');
    await userEvent.hover(button);
    await waitFor(() => {
      expect(screen.getByText('First, select a metric.')).toBeInTheDocument();
    });
  });

  it('calls setShowDrawer when button is clicked', async () => {
    const props = createProps(true, 'metric', setShowDrawer);
    render(<QueryAssistantButton {...props} />);
    const button = screen.getByText('Get query suggestions');
    fireEvent.click(button);
    expect(setShowDrawer).toHaveBeenCalled();
  });
});

function createProps(llmAppEnabled: boolean, metric: string, setShowDrawer: () => void) {
  return {
    llmAppEnabled,
    metric,
    setShowDrawer,
  };
}
