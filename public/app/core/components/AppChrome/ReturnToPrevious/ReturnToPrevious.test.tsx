import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';

import { getGrafanaContextMock } from '../../../../../test/mocks/getGrafanaContextMock';
import { UnthemedDashboardPage } from '../../../../features/dashboard/containers/DashboardPage';
import { GrafanaContext } from '../../../context/GrafanaContext';

import { ReturnToPrevious } from './ReturnToPrevious';

const renderComponent = () => {
  const title = 'test section';
  const href = 'https://grafana.com/';

  const grafanaContext = getGrafanaContextMock();
  // TODO: grafanaContext.chrome.returnToPreviousData(???) => currently undefined, need to be mocked

  return render(
    <GrafanaContext.Provider value={grafanaContext}>
      <Router history={locationService.getHistory()}>
        <ReturnToPrevious title={title} href={href} />
      </Router>
    </GrafanaContext.Provider>
  );
};

describe('ReturnToPrevious', () => {
  // afterEach(() => {
  //   window.localStorage.clear();
  // });

  it('should disappear after clicking dismiss button', async () => {
    renderComponent();
    await userEvent.click(screen.findByRole('button', { name: 'Close' }));
    expect(screen.findByRole('button', { name: 'Back to test section' })).not.toBeInTheDocument();
  });
});
