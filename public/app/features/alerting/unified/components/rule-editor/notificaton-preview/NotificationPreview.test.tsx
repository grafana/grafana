import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { byRole, byText } from 'testing-library-selector';

import { TestProvider } from '../../../../../../../test/helpers/TestProvider';
import { MatcherOperator } from '../../../../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../../../../types/unified-alerting-dto';
import { mockApi, setupMswServer } from '../../../mockApi';
import { mockAlertQuery } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import * as notificationPreview from './NotificationPreview';
import {
  NOTIFICATION_PREVIEW_TITLE,
  NotificationPreview,
  NotificationPreviewByAlertManager,
} from './NotificationPreview';

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

const ui = {
  routeButton: byRole('button', { name: /Notification policy/ }),
  loadingIndicator: byText('Loading routing preview...'),
};

const server = setupMswServer();

beforeEach(() => {
  jest.clearAllMocks();
});

const alertQuery = mockAlertQuery({ datasourceUid: 'whatever', refId: 'A' });

describe('NotificationPreview', () => {
  it('should render notification preview', async () => {
    render(<NotificationPreview alertQueries={[alertQuery]} customLabels={[]} condition="" />, {
      wrapper: TestProvider,
    });
    await waitFor(() => {
      expect(screen.getByText(NOTIFICATION_PREVIEW_TITLE)).toBeInTheDocument();
    });
    screen.debug();
  });
});

describe('NotificationPreviewByAlertmanager', () => {
  it('should render route matching preview for alertmanager', async () => {
    const potentialInstances: Labels[] = [
      { foo: 'bar', severity: 'critical' },
      { job: 'prometheus', severity: 'warning' },
    ];

    mockApi(server).getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, (amConfigBuilder) =>
      amConfigBuilder
        .withRoute((routeBuilder) =>
          routeBuilder
            .withReceiver('email')
            .addRoute((rb) => rb.withReceiver('slack').addMatcher('severity', MatcherOperator.equal, 'critical'))
            .addRoute((rb) => rb.withReceiver('opsgenie').addMatcher('team', MatcherOperator.equal, 'operations'))
        )
        .addReceivers((b) => b.withName('email').addEmailConfig((eb) => eb.withTo('test@example.com')))
        .addReceivers((b) => b.withName('slack'))
        .addReceivers((b) => b.withName('opsgenie'))
    );

    render(
      <NotificationPreviewByAlertManager
        alertManagerSource={{ name: GRAFANA_RULES_SOURCE_NAME, img: '' }}
        potentialInstances={potentialInstances}
        onlyOneAM={true}
      />,
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(ui.loadingIndicator.query()).not.toBeInTheDocument();
    });

    const matchingPoliciesElements = ui.routeButton.queryAll();
    expect(matchingPoliciesElements).toHaveLength(2);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/severity = critical/);
    expect(matchingPoliciesElements[0]).toHaveTextContent(/slack/);
    expect(matchingPoliciesElements[1]).toHaveTextContent(/email/);
  });
});
