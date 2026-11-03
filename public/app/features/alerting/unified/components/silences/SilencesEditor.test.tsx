import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { type SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockAlertmanagerAlert, mockDataSource } from '../../mocks';
import { getAlertRuleHandler, mockK8sAlertRule } from '../../mocks/server/handlers/k8s/alertRules.k8s';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { SilencesEditor } from './SilencesEditor';

const RULE_UID = 'rule-uid-1';
const RULE_TITLE = 'CPU usage high';

const server = setupMswServer();

const dataSources = {
  am: mockDataSource({ name: GRAFANA_RULES_SOURCE_NAME, type: DataSourceType.Alertmanager }),
};

const saveButton = () => screen.getByRole('button', { name: /save silence/i });
const commentField = () => screen.getByLabelText(/comment/i);
const findRuleField = () => screen.findByRole('textbox', { name: /^alert rule/i });

const renderEditor = (overrides: { onSilenceCreated?: jest.Mock; onCancel?: jest.Mock } = {}) => {
  const onSilenceCreated = overrides.onSilenceCreated ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();

  const { user } = render(
    <AlertmanagerProvider accessType="instance" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
      <SilencesEditor
        ruleUid={RULE_UID}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onSilenceCreated={onSilenceCreated}
        onCancel={onCancel}
      />
    </AlertmanagerProvider>
  );

  return { user, onSilenceCreated, onCancel };
};

const captureCreateSilence = (failFirstAttempt = false) => {
  const captured: { bodies: SilenceCreatePayload[]; attempts: number } = { bodies: [], attempts: 0 };

  server.use(
    http.post('/api/alertmanager/:datasourceUid/api/v2/silences', async ({ request }) => {
      captured.attempts += 1;
      captured.bodies.push((await request.json()) as SilenceCreatePayload);

      if (failFirstAttempt && captured.attempts === 1) {
        return HttpResponse.json({ message: 'could not create' }, { status: 500 });
      }

      return HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' });
    })
  );

  return captured;
};

beforeEach(() => {
  setupDataSources(dataSources.am);
  grantUserPermissions([]);
  contextSrv.user.isSignedIn = true;
  contextSrv.user.name = 'admin';
});

describe('SilencesEditor preview label matchers', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);
    server.use(
      getAlertRuleHandler([mockK8sAlertRule({ uid: RULE_UID, title: RULE_TITLE })]),
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', () =>
        HttpResponse.json([mockAlertmanagerAlert({ labels: { severity: 'warning', region: 'US-Central' } })])
      )
    );
  });

  it('adds a clicked label once, refreshes the preview and submits an exact matcher', async () => {
    const previewFilters: string[][] = [];
    server.use(
      http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
        previewFilters.push(new URL(request.url).searchParams.getAll('filter'));
        return HttpResponse.json([mockAlertmanagerAlert({ labels: { severity: 'warning' } })]);
      })
    );
    const captured = captureCreateSilence();
    const { user, onSilenceCreated } = renderEditor();

    await user.click(await screen.findByRole('button', { name: 'severity warning' }));

    expect(screen.getByRole('textbox', { name: /^label$/i })).toHaveValue('severity');
    expect(screen.getByRole('textbox', { name: /^value$/i })).toHaveValue('warning');
    expect(captured.attempts).toBe(0);
    await waitFor(() =>
      expect(previewFilters).toContainEqual(['__alert_rule_uid__="rule-uid-1"', 'severity="warning"'])
    );

    await user.click(await screen.findByRole('button', { name: 'severity warning' }));
    await user.click(saveButton());

    await waitFor(() => expect(onSilenceCreated).toHaveBeenCalledTimes(1));
    expect(captured.bodies[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: 'severity', value: 'warning' },
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it.each([
    { description: 'complete', name: 'region', value: 'US-Central' },
    { description: 'name-only', name: 'region', value: '' },
    { description: 'value-only', name: '', value: 'US-Central' },
  ])('appends a matcher without overwriting a $description row', async ({ name, value }) => {
    const { user } = renderEditor();
    if (name) {
      await user.type(screen.getByRole('textbox', { name: /^label$/i }), name);
    }
    if (value) {
      await user.type(screen.getByRole('textbox', { name: /^value$/i }), value);
    }
    await user.click(await screen.findByRole('button', { name: 'severity warning' }));

    const matcherLabels = screen.getAllByRole('textbox', { name: /^label$/i });
    const matcherValues = screen.getAllByRole('textbox', { name: /^value$/i });
    expect(matcherLabels).toHaveLength(2);
    expect(matcherLabels[0]).toHaveValue(name);
    expect(matcherValues[0]).toHaveValue(value);
    expect(matcherLabels[1]).toHaveValue('severity');
    expect(matcherValues[1]).toHaveValue('warning');
  });
});

describe('SilencesEditor', () => {
  it('shows the title of the silenced rule from the Kubernetes rules API', async () => {
    const rulerRequests: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.startsWith('/api/ruler/')) {
        rulerRequests.push(request.url);
      }
    });
    server.use(getAlertRuleHandler([mockK8sAlertRule({ uid: RULE_UID, title: RULE_TITLE })]));
    renderEditor();

    expect(await findRuleField()).toHaveValue(RULE_TITLE);
    expect(screen.getByText('Refine affected alerts')).toBeInTheDocument();
    expect(screen.getByText('This silence applies only to alerts from this alert rule.')).toBeInTheDocument();
    expect(rulerRequests).toEqual([]);
    server.events.removeAllListeners('request:start');
  });

  it('explains that the rule is unavailable when it cannot be loaded, and still scopes to its UID', async () => {
    server.use(getAlertRuleHandler([]));
    const captured = captureCreateSilence();
    const { user, onSilenceCreated } = renderEditor();

    expect(await findRuleField()).toHaveValue('Alert rule unavailable');
    expect(
      screen.getByText(new RegExp(`only to alerts from the alert rule with UID ${RULE_UID}.*may have been deleted`))
    ).toBeInTheDocument();

    await user.click(saveButton());

    await waitFor(() => expect(onSilenceCreated).toHaveBeenCalledTimes(1));
    expect(captured.bodies[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it('calls onSilenceCreated after a successful submit', async () => {
    const captured = captureCreateSilence();
    const { user, onSilenceCreated } = renderEditor();

    await user.click(saveButton());

    await waitFor(() => expect(onSilenceCreated).toHaveBeenCalledTimes(1));
    expect(captured.bodies[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it('preserves named matchers with empty values when submitting', async () => {
    const captured = captureCreateSilence();
    const { user, onSilenceCreated } = renderEditor();

    await user.type(screen.getByRole('textbox', { name: /^label$/i }), 'region');
    await user.click(saveButton());

    await waitFor(() => expect(onSilenceCreated).toHaveBeenCalledTimes(1));
    expect(captured.bodies[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: 'region', value: '' },
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it('calls onCancel without submitting when the user cancels', async () => {
    const captured = captureCreateSilence();
    const { user, onCancel } = renderEditor();

    await user.click(screen.getByText(/^cancel$/i));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(captured.attempts).toBe(0);
  });

  it('keeps the editor open with the entered values when the submit fails', async () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');
    captureCreateSilence(true);
    const { user, onSilenceCreated } = renderEditor();

    await user.clear(commentField());
    await user.type(commentField(), 'investigating outage');

    await user.click(saveButton());

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertError, ['Could not create silence']));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(onSilenceCreated).not.toHaveBeenCalled();
    expect(commentField()).toHaveValue('investigating outage');
  });

  it('submits exactly one rule UID matcher when retrying after a failure', async () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');
    const captured = captureCreateSilence(true);
    const { user, onSilenceCreated } = renderEditor();

    await user.click(saveButton());
    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertError, ['Could not create silence']));
    await waitFor(() => expect(saveButton()).toBeEnabled());

    await user.click(saveButton());
    await waitFor(() => expect(onSilenceCreated).toHaveBeenCalledTimes(1));

    expect(captured.bodies).toHaveLength(2);
    const ruleUidMatchers = (captured.bodies[1]?.matchers ?? []).filter((m) => m.name === '__alert_rule_uid__');
    expect(ruleUidMatchers).toEqual([{ isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID }]);
  });
});
