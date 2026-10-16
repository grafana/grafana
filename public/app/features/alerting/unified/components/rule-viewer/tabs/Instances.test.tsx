import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockGrafanaPromAlertingRule,
  mockGrafanaRulerRule,
  mockPromAlert,
} from '../../../mocks';

import { InstancesList } from './Instances';

jest.mock('../../../useRouteGroupsMatcher');

setupMswServer();

it('shows instance silencing alongside the notification route action', async () => {
  grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
  const rule = mockCombinedRule({
    rulerRule: mockGrafanaRulerRule(),
    promRule: mockGrafanaPromAlertingRule({
      alerts: [mockPromAlert({ state: GrafanaAlertState.Alerting })],
    }),
  });
  render(<InstancesList rule={rule} />);

  expect(await screen.findByRole('button', { name: /^view route$/i })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /^silence$/i })).toBeInTheDocument();
});
