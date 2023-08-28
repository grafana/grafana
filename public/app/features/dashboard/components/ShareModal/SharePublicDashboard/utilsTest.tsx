import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { rest } from 'msw';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../../store/configureStore';
import { DashboardInitPhase } from '../../../../../types';
import { DashboardModel, PanelModel } from '../../../state';
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
  rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ...pubdashResponse,
        ...publicDashboard,
        dashboardUid: req.params.dashboardUid,
      })
    );
  });

export const renderSharePublicDashboard = async (
  props?: Partial<React.ComponentProps<typeof ShareModal>>,
  isEnabled = true
) => {
  const store = configureStore({
    dashboard: {
      getModel: () => props?.dashboard || mockDashboard,
      permissions: [],
      initError: null,
      initPhase: DashboardInitPhase.Completed,
    },
  });

  const newProps = Object.assign(
    {
      panel: mockPanel,
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
