import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { config, reportInteraction } from '@grafana/runtime';

import { ReturnToPrevious, ReturnToPreviousProps } from './ReturnToPrevious';

const mockReturnToPreviousProps: ReturnToPreviousProps = {
  title: 'Dashboards Page',
  href: '/dashboards',
};
const reportInteractionMock = jest.mocked(reportInteraction);
jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: reportInteractionMock,
  };
});
jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});
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
  beforeEach(() => {
    /* We enabled the feature toggle */
    config.featureToggles.returnToPrevious = true;
  });
  afterEach(() => {
    window.sessionStorage.clear();
    jest.resetAllMocks();
    config.featureToggles.returnToPrevious = false;
  });
  it('should render component', async () => {
    setup();
    expect(await screen.findByTitle('Back to Dashboards Page')).toBeInTheDocument();
  });

  it('should trigger event once when clicking on the RTP button', async () => {
    setup();
    const returnButton = await screen.findByTitle('Back to Dashboards Page');
    expect(returnButton).toBeInTheDocument();
    await userEvent.click(returnButton);
    const mockCalls = reportInteractionMock.mock.calls;
    /* The report is called 'grafana_return_to_previous_button_dismissed' but the action is 'clicked' */
    const mockReturn = mockCalls.filter((call) => call[0] === 'grafana_return_to_previous_button_dismissed');
    expect(mockReturn).toHaveLength(1);
  });

  it('should trigger event once when clicking on the Close button', async () => {
    setup();

    const closeBtn = await screen.findByRole('button', { name: 'Close' });
    expect(closeBtn).toBeInTheDocument();
    await userEvent.click(closeBtn);
    const mockCalls = reportInteractionMock.mock.calls;
    /* The report is called 'grafana_return_to_previous_button_dismissed' but the action is 'dismissed' */
    const mockDismissed = mockCalls.filter((call) => call[0] === 'grafana_return_to_previous_button_dismissed');
    expect(mockDismissed).toHaveLength(1);
  });
});
