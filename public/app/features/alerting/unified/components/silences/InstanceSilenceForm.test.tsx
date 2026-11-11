import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { InstanceSilenceForm } from './InstanceSilenceForm';
import { SilencesEditor } from './SilencesEditor';

jest.mock('./SilencesEditor', () => {
  const React = jest.requireActual('react');
  const { useAlertmanager } = jest.requireActual('../../state/AlertmanagerContext');

  return {
    SilencesEditor: jest.fn(() => {
      const { selectedAlertmanager } = useAlertmanager();
      return React.createElement('span', { 'data-testid': 'selected-am' }, selectedAlertmanager);
    }),
  };
});

setupMswServer();

const RULE_UID = 'rule-uid-1';
const EXTERNAL_AM_NAME = 'external-am';

const instanceLabels = {
  alertname: 'CPU high',
  severity: 'critical',
  __alert_rule_uid__: RULE_UID,
  __grafana_managed_route__: 'default',
};

beforeEach(() => {
  contextSrv.user.isSignedIn = true;
  contextSrv.user.name = 'admin';
  grantUserPermissions([AccessControlAction.AlertingInstanceCreate, AccessControlAction.AlertingInstancesExternalRead]);
  setupDataSources(
    mockDataSource({ name: GRAFANA_RULES_SOURCE_NAME, type: DataSourceType.Alertmanager }),
    mockDataSource({ name: EXTERNAL_AM_NAME, type: DataSourceType.Alertmanager })
  );
  jest.mocked(SilencesEditor).mockClear();
});

describe('InstanceSilenceForm', () => {
  it('prefills exact matchers for public labels only and passes the rule UID as fixed scope', () => {
    render(<InstanceSilenceForm ruleUid={RULE_UID} instanceLabels={instanceLabels} onClose={jest.fn()} />);

    const props = jest.mocked(SilencesEditor).mock.calls[0][0];
    expect(props.ruleUid).toBe(RULE_UID);
    expect(props.formValues?.matchers).toEqual([
      { name: 'alertname', value: 'CPU high', operator: MatcherOperator.equal },
      { name: 'severity', value: 'critical', operator: MatcherOperator.equal },
    ]);
  });

  it('pins the Alertmanager context to Grafana when another Alertmanager is selected by URL', async () => {
    render(<InstanceSilenceForm ruleUid={RULE_UID} instanceLabels={instanceLabels} onClose={jest.fn()} />, {
      historyOptions: { initialEntries: [`/?alertmanager=${EXTERNAL_AM_NAME}`] },
    });

    expect(await screen.findByTestId('selected-am')).toHaveTextContent(GRAFANA_RULES_SOURCE_NAME);
  });
});
