import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice, type SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { isLoading } from '../../hooks/abilities/abilityUtils';
import { usePromRuleSilenceAbility } from '../../hooks/abilities/rules/promRuleAbilities';
import { skipToken } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { useRuleSilenceAbility } from '../../hooks/abilities/rules/rulerRuleAbilities';
import { mockAlertRuleApi, setupMswServer } from '../../mockApi';
import {
  grantUserPermissions,
  mockCombinedRule,
  mockGrafanaPromAlertingRule,
  mockGrafanaRulerRule,
  mockPromAlert,
} from '../../mocks';
import { setAlertmanagerChoices, setFolderAccessControl } from '../../mocks/server/configure';
import { prometheusRuleType } from '../../utils/rules';

import { AlertInstanceSilenceAction } from './AlertInstanceSilenceAction';

const RULE_UID = 'rule-uid-1';
const FOLDER_UID = 'NAMESPACE_UID';

const server = setupMswServer();

const grafanaRule = (rulerOverrides: Parameters<typeof mockGrafanaRulerRule>[0] = {}) =>
  mockCombinedRule({
    rulerRule: mockGrafanaRulerRule({ uid: RULE_UID, namespace_uid: FOLDER_UID, title: 'CPU high', ...rulerOverrides }),
  });

const instance = (overrides: Parameters<typeof mockPromAlert>[0] = {}) =>
  mockPromAlert({
    state: GrafanaAlertState.Alerting,
    labels: {
      alertname: 'CPU high',
      severity: 'critical',
      instance: 'server-1',
      __alert_rule_uid__: RULE_UID,
      __grafana_managed_route__: 'default',
    },
    ...overrides,
  });

const querySilenceButton = () => screen.queryByRole('button', { name: /^silence$/i });
const findSilenceButton = () => screen.findByRole('button', { name: /^silence$/i });

/** Renders the same silence ability the action gates on so tests can wait for it to settle. */
function SilenceAbilityProbe({ rule }: { rule: CombinedRule }) {
  const rulerAbility = useRuleSilenceAbility(rule.rulerRule);
  const promAbility = usePromRuleSilenceAbility(
    prometheusRuleType.grafana.alertingRule(rule.promRule) ? rule.promRule : skipToken
  );
  const settled = !isLoading(rulerAbility) && !isLoading(promAbility);

  return <span data-testid="silence-ability-status">{settled ? 'settled' : 'loading'}</span>;
}

const settledIndicator = () => screen.getByTestId('silence-ability-status');

let mainView: HTMLDivElement;

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
  setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });
  contextSrv.user.isSignedIn = true;
  contextSrv.user.name = 'admin';

  mainView = document.createElement('div');
  mainView.classList.add('main-view');
  document.body.appendChild(mainView);
});

afterEach(() => {
  document.body.removeChild(mainView);
});

describe('AlertInstanceSilenceAction', () => {
  it('hides the Silence button while the ability is loading and shows it once granted', async () => {
    const rule = grafanaRule();
    render(
      <>
        <SilenceAbilityProbe rule={rule} />
        <AlertInstanceSilenceAction rule={rule} instance={instance()} />
      </>
    );

    expect(settledIndicator()).toHaveTextContent('loading');
    expect(querySilenceButton()).not.toBeInTheDocument();

    await waitFor(() => expect(settledIndicator()).toHaveTextContent('settled'));
    expect(await findSilenceButton()).toBeInTheDocument();
  });

  it('renders a Silence button when permission comes only from the rule folder', async () => {
    grantUserPermissions([]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    expect(await findSilenceButton()).toBeInTheDocument();
  });

  it('does not render a Silence button once the ability resolves without permission', async () => {
    grantUserPermissions([]);
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });
    const rule = grafanaRule();

    render(
      <>
        <SilenceAbilityProbe rule={rule} />
        <AlertInstanceSilenceAction rule={rule} instance={instance()} />
      </>
    );

    await waitFor(() => expect(settledIndicator()).toHaveTextContent('settled'));
    expect(querySilenceButton()).not.toBeInTheDocument();
  });

  it('does not render a Silence button once Grafana Alertmanager silences are disabled', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);
    const rule = grafanaRule();

    render(
      <>
        <SilenceAbilityProbe rule={rule} />
        <AlertInstanceSilenceAction rule={rule} instance={instance()} />
      </>
    );

    await waitFor(() => expect(settledIndicator()).toHaveTextContent('settled'));
    expect(querySilenceButton()).not.toBeInTheDocument();
  });

  it('renders a Silence button for a provisioned rule', async () => {
    render(<AlertInstanceSilenceAction rule={grafanaRule({ provenance: 'terraform' })} instance={instance()} />);

    expect(await findSilenceButton()).toBeInTheDocument();
  });

  it('renders a Silence button when only the Grafana prom rule is available', async () => {
    const rule = mockCombinedRule({
      rulerRule: undefined,
      promRule: mockGrafanaPromAlertingRule({ uid: RULE_UID, folderUid: FOLDER_UID }),
    });

    render(<AlertInstanceSilenceAction rule={rule} instance={instance()} />);

    expect(await findSilenceButton()).toBeInTheDocument();
  });

  it('opens the drawer with an exact matcher for every public instance label', async () => {
    const user = userEvent.setup();
    mockAlertRuleApi(server).getAlertRule(RULE_UID, mockGrafanaRulerRule({ uid: RULE_UID }));

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    await user.click(await findSilenceButton());

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('label').map((input) => (input as HTMLInputElement).value)).toEqual([
      'alertname',
      'severity',
      'instance',
    ]);
    expect(screen.getAllByPlaceholderText('value').map((input) => (input as HTMLInputElement).value)).toEqual([
      'CPU high',
      'critical',
      'server-1',
    ]);
  });

  it('submits the instance matchers together with a single rule UID', async () => {
    const user = userEvent.setup();
    const captured: { bodies: SilenceCreatePayload[] } = { bodies: [] };
    server.use(
      http.post('/api/alertmanager/:datasourceUid/api/v2/silences', async ({ request }) => {
        captured.bodies.push((await request.json()) as SilenceCreatePayload);
        return HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' });
      })
    );

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    await user.click(await findSilenceButton());
    await user.click(await screen.findByRole('button', { name: /save silence/i }));

    await waitFor(() => expect(captured.bodies).toHaveLength(1));
    expect(captured.bodies[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: 'alertname', value: 'CPU high' },
      { isEqual: true, isRegex: false, name: 'severity', value: 'critical' },
      { isEqual: true, isRegex: false, name: 'instance', value: 'server-1' },
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it('closes the drawer after a successful save', async () => {
    const user = userEvent.setup();

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    await user.click(await findSilenceButton());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /save silence/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes the drawer on cancel without changing the location', async () => {
    const user = userEvent.setup();
    const locationBefore = locationService.getLocation();

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    await user.click(await findSilenceButton());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByText(/^cancel$/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(locationService.getLocation().pathname).toBe(locationBefore.pathname);
    expect(locationService.getLocation().search).toBe(locationBefore.search);
  });

  it('keeps the drawer open with the entered values once a failed save settles', async () => {
    const user = userEvent.setup();
    const emitSpy = jest.spyOn(appEvents, 'emit');
    let attempts = 0;
    server.use(
      http.post('/api/alertmanager/:datasourceUid/api/v2/silences', () => {
        attempts += 1;
        return HttpResponse.json({ message: 'could not create' }, { status: 500 });
      })
    );

    render(<AlertInstanceSilenceAction rule={grafanaRule()} instance={instance()} />);

    await user.click(await findSilenceButton());
    const comment = await screen.findByLabelText(/comment/i);
    await user.clear(comment);
    await user.type(comment, 'investigating');

    await user.click(screen.getByRole('button', { name: /save silence/i }));

    await waitFor(() => expect(attempts).toBe(1));
    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertError, ['Could not create silence']));
    await waitFor(() => expect(screen.getByRole('button', { name: /save silence/i })).toBeEnabled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/comment/i)).toHaveValue('investigating');
  });
});
