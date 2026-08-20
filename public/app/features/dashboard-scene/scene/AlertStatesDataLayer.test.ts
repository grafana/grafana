import { DataFrameView, DataTopic, type AlertStateInfo, AlertState, LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  grantUserPermissions,
  mockGrafanaPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
} from 'app/features/alerting/unified/mocks';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import * as store from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertStatesDataLayer } from './AlertStatesDataLayer';

jest.mock('../utils/utils', () => ({
  ...jest.requireActual('../utils/utils'),
  getDashboardSceneFor: () => ({ state: { uid: 'a uid' } }),
}));

function getTestContext() {
  jest.clearAllMocks();
  config.publicDashboardAccessToken = '';
  grantUserPermissions(Object.values(AccessControlAction));
  const dispatchMock = jest.spyOn(store, 'dispatch');
  return { dispatchMock };
}

describe('AlertStatesDataLayer', () => {
  it('publishes the ruleUID of the most severe alert linked to a panel', (done) => {
    const nameSpaces = [
      mockPromRuleNamespace({
        groups: [
          mockPromRuleGroup({
            name: 'group1',
            rules: [
              mockGrafanaPromAlertingRule({
                uid: 'rule-ok',
                name: 'alert-ok',
                state: PromAlertingRuleState.Inactive,
                annotations: { [Annotation.panelID]: '1' },
              }),
              mockGrafanaPromAlertingRule({
                uid: 'rule-firing',
                name: 'alert-firing',
                state: PromAlertingRuleState.Firing,
                annotations: { [Annotation.panelID]: '1' },
              }),
            ],
          }),
        ],
      }),
    ];

    const { dispatchMock } = getTestContext();
    dispatchMock.mockResolvedValue({ data: nameSpaces });

    const layer = new AlertStatesDataLayer({ name: 'Alert States' });
    layer.activate();

    layer.getResultsStream().subscribe((result) => {
      if (result.data.state !== LoadingState.Done) {
        return;
      }

      const frame = result.data.series[0];
      expect(frame.meta?.dataTopic).toBe(DataTopic.AlertStates);

      const [row] = new DataFrameView<AlertStateInfo>(frame);
      expect(row.panelId).toBe(1);
      expect(row.state).toBe(AlertState.Alerting);
      expect(row.ruleUID).toBe('rule-firing');
      done();
    });
  });

  it('does not set a ruleUID when the linked rule has none', (done) => {
    const nameSpaces = [
      mockPromRuleNamespace({
        groups: [
          mockPromRuleGroup({
            name: 'group1',
            rules: [
              mockGrafanaPromAlertingRule({
                uid: undefined,
                name: 'alert-ok',
                state: PromAlertingRuleState.Inactive,
                annotations: { [Annotation.panelID]: '1' },
              }),
            ],
          }),
        ],
      }),
    ];

    const { dispatchMock } = getTestContext();
    dispatchMock.mockResolvedValue({ data: nameSpaces });

    const layer = new AlertStatesDataLayer({ name: 'Alert States' });
    layer.activate();

    layer.getResultsStream().subscribe((result) => {
      if (result.data.state !== LoadingState.Done) {
        return;
      }

      const [row] = new DataFrameView<AlertStateInfo>(result.data.series[0]);
      expect(row.ruleUID).toBeUndefined();
      done();
    });
  });
});
