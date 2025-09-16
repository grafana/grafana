import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import * as React from 'react';
import { Provider } from 'react-redux';

import { DashboardInitPhase } from 'app/types/dashboard';

import { configureStore } from '../../../../../store/configureStore';
import { DashboardModel } from '../../../state/DashboardModel';
import { PanelModel } from '../../../state/PanelModel';
import { createDashboardModelFixture } from '../../../state/__fixtures__/dashboardFixtures';
import { ShareModal } from '../ShareModal';

import * as sharePublicDashboardUtils from './SharePublicDashboardUtils';
import { PublicDashboard, PublicDashboardShareType } from './SharePublicDashboardUtils';

export const mockDashboard: DashboardModel = createDashboardModelFixture({
  uid: 'mockDashboardUid',
  timezone: 'utc',
});

export const mockPanel = new PanelModel({
  id: 'mockPanelId',
});

export const pubdashResponse: sharePublicDashboardUtils.PublicDashboard = {
  isEnabled: true,
  annotationsEnabled: true,
  timeSelectionEnabled: true,
  uid: 'a-uid',
  dashboardUid: '',
  accessToken: 'an-access-token',
  share: PublicDashboardShareType.PUBLIC,
};

export const getExistentPublicDashboardResponse = (publicDashboard?: Partial<PublicDashboard>) =>
  http.get('/api/dashboards/uid/:dashboardUid/public-dashboards', ({ request }) => {
    const url = new URL(request.url);
    const dashboardUid = url.searchParams.get('dashboardUid');
    return HttpResponse.json({
      ...pubdashResponse,
      ...publicDashboard,
      dashboardUid,
    });
  });

export const renderSharePublicDashboard = async (
  props?: Partial<React.ComponentProps<typeof ShareModal>>,
  isEnabled = true
) => {
  const store = configureStore({
    dashboard: {
      getModel: () => props?.dashboard || mockDashboard,
      initError: null,
      initPhase: DashboardInitPhase.Completed,
    },
  });

  const newProps = Object.assign(
    {
      dashboard: mockDashboard,
      onDismiss: () => {},
    },
    props
  );

  const renderResult = render(
    <Provider store={store}>
      <ShareModal {...newProps} />
    </Provider>
  );

  await waitFor(() => screen.getByText('Link'));
  if (isEnabled) {
    fireEvent.click(screen.getByText('Public dashboard'));
    await waitForElementToBeRemoved(screen.getByText('Loading configuration'));
  }

  return renderResult;
};
