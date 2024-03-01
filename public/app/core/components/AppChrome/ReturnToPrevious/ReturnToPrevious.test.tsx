import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { reportInteraction } from '@grafana/runtime';

import { ReturnToPrevious, ReturnToPreviousProps } from './ReturnToPrevious';

const mockReturnToPreviousProps: ReturnToPreviousProps = {
  title: 'Dashboards Page',
  href: '/dashboards',
};
jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});
const reportInteractionMock = jest.mocked(reportInteraction);

const setup = () => {
  const grafanaContext = getGrafanaContextMock();
  grafanaContext.chrome.setReturnToPrevious(mockReturnToPreviousProps);
  return render(
    <TestProvider grafanaContext={grafanaContext}>
      <ReturnToPrevious {...mockReturnToPreviousProps} />
    </TestProvider>
  );
};

describe('ReturnToPrevious', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });
  it('should render component', async () => {
    setup();
    expect(await screen.findByTitle('Back to Dashboards Page')).toBeInTheDocument();
  });

  it('should trigger event once when clicking on the Close button', async () => {
    setup();
    const closeBtn = await screen.findByRole('button', { name: 'Close' });
    expect(closeBtn).toBeInTheDocument();
    await userEvent.click(closeBtn);
    const [args] = reportInteractionMock.mock.calls;
    const [interactionName, properties] = args;

    expect(reportInteractionMock.mock.calls.length).toBe(1);
    expect(interactionName).toBe('grafana_return_to_previous_button_dismissed');
    expect(properties).toEqual({
      action: 'dismissed',
      page: mockReturnToPreviousProps.href,
    });
  });
});
