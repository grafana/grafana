import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime/src';
import { GrafanaContext } from 'app/core/context/GrafanaContext';

import { getGrafanaContextMock } from '../../../../../test/mocks/getGrafanaContextMock';
import { setStarred } from '../../../../core/reducers/navBarTree';
import { configureStore } from '../../../../store/configureStore';
import { updateTimeZoneForSession } from '../../../profile/state/reducers';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { DashNav } from './DashNav';

describe('Public dashboard title tag', () => {
  it('will be rendered when publicDashboardEnabled set to true in dashboard meta', async () => {
    let dashboard = createDashboardModelFixture({}, { publicDashboardEnabled: false });

    const store = configureStore();
    const context = getGrafanaContextMock();
    const props = {
      setStarred: jest.fn() as unknown as typeof setStarred,
      updateTimeZoneForSession: jest.fn() as unknown as typeof updateTimeZoneForSession,
    };

    render(
      <Provider store={store}>
        <GrafanaContext.Provider value={context}>
          <Router history={locationService.getHistory()}>
            <DashNav
              {...props}
              dashboard={dashboard}
              hideTimePicker={true}
              isFullscreen={false}
              onAddPanel={() => {}}
              title="test"
            />
          </Router>
        </GrafanaContext.Provider>
      </Provider>
    );

    const publicTag = screen.queryByText('Public');
    expect(publicTag).not.toBeInTheDocument();

    act(() => {
      dashboard.updateMeta({ publicDashboardEnabled: true });
    });

    await waitFor(() => screen.getByText('Public'));
  });
});
