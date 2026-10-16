import { act, render, screen } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
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

afterEach(() => {
  act(() => setTestFlags({}));
});

it('toggles instance silencing without hiding the notification route action', async () => {
  grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
  const rule = mockCombinedRule({
    rulerRule: mockGrafanaRulerRule(),
    promRule: mockGrafanaPromAlertingRule({
      alerts: [mockPromAlert({ state: GrafanaAlertState.Alerting })],
    }),
  });
  render(<InstancesList rule={rule} />);

  expect(await screen.findByRole('button', { name: /^view route$/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^silence$/i })).not.toBeInTheDocument();

  act(() => setTestFlags({ [FlagKeys.AlertingInstanceSilence]: true }));
  expect(await screen.findByRole('button', { name: /^silence$/i })).toBeInTheDocument();

  act(() => setTestFlags({ [FlagKeys.AlertingInstanceSilence]: false }));
  expect(screen.queryByRole('button', { name: /^silence$/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^view route$/i })).toBeInTheDocument();
});
