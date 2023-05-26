import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { mockAlertQuery } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import * as notificationPreview from './NotificationPreview';
import { NotificationPreview, NOTIFICATION_PREVIEW_TITLE } from './NotificationPreview';

jest
  .spyOn(notificationPreview, 'useGetAlertManagersSourceNamesAndImage')
  .mockReturnValue([{ name: GRAFANA_RULES_SOURCE_NAME, img: '' }]);

// const receiversByName = new Map(
//     [
//         ['receiver1', {
//             name: 'receiver1',
//             email_configs: [{ to: ' to1' }],
//             slack_configs: [{ channel: 'channel1' }],

//         }]
//     ]
// );
// const routesByIdMap = new Map(
//     [
//         ['route1', {
//             receiver: 'receiver1',
//             group_by: ['severity'],
//             group_wait: '1m',
//             group_interval: '1m',
//             repeat_interval: '1m',
//             match: { severity: 'tomato' },
//             routes: [{ receiver: 'receiver1' }],
//         }]
//     ]
// );

// jest.spyOn(notificationPreview, 'useGetPotentialInstancesByAlertManager')
//     .mockReturnValue({
//         routesByIdMap: routesByIdMap,
//         receiversByName: receiversByName,
//     });

beforeEach(() => {
  jest.clearAllMocks();
});

const alertQuery = mockAlertQuery({ datasourceUid: 'whatever', refId: 'A' });

describe('NotificationPreview', () => {
  it('should render notification preview', async () => {
    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="" />);
    await waitFor(() => {
      expect(screen.getByText(NOTIFICATION_PREVIEW_TITLE)).toBeInTheDocument();
    });
    screen.debug();
  });
});
