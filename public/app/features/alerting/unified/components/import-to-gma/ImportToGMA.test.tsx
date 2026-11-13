import { HttpResponse, http } from 'msw';
import { act, render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { CodeMirrorEditor, type CodeMirrorEditorProps } from '@grafana/ui/unstable';
import { appEvents } from 'app/core/app_events';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { convertResponse } from '../../mocks/convertApi';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  setupAutoSyncConfig,
  setupAutoSyncConfigAbsent,
  setupAutoSyncConfigWriteError,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { ImportWizardGate } from './ImportToGMA';

// Spread requireActual so config/locationService/feature-toggle reads stay real; only stub the
// analytics sink so we can assert the reported payload.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Keep these tests focused on the preview's content and editor integration.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: jest.fn(({ value, readOnly, 'aria-label': label }: CodeMirrorEditorProps) => (
    <textarea data-testid="code-editor" aria-label={label} value={value} readOnly={readOnly} />
  )),
}));

// Selects which fixture the mocked Step1Content below seeds. Prefixed `mock` per Jest's rule for
// variables referenced from inside a jest.mock factory. Each describe block resets it in its own setup.
let mockScenario:
  | 'yaml'
  | 'auto-sync'
  | 'auto-sync-custom-name'
  | 'datasource'
  | 'datasource-unnamed'
  | 'schema-derived-secrets'
  | 'no-secrets'
  | 'flush-indented-yaml'
  | 'empty' = 'yaml';

// Seeds form values directly instead of rendering the real step body (network-backed pickers we
// don't need). policyTreeName also gets a real input, since tests below need to edit it.
jest.mock('./steps/Step1AlertmanagerResources', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step1Content: function Step1Content() {
      const { setValue, register, getValues } = useFormContext();
      useEffect(() => {
        // Nothing filled in: step 1's single Next button skips it.
        if (mockScenario === 'empty') {
          return;
        }
        if (mockScenario === 'auto-sync' || mockScenario === 'auto-sync-custom-name') {
          if (mockScenario === 'auto-sync-custom-name') {
            setValue('policyTreeName', 'typed-before-auto-sync');
          }
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          setValue('autoSyncNotificationsEnabled', true);
          return;
        }
        // Don't reseed on remount (e.g. navigating back to Step 1) — a fresh File would get a new
        // lastModified and look like an edit.
        if (getValues('notificationsYamlFile')) {
          return;
        }
        if (mockScenario === 'datasource-unnamed') {
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          return;
        }
        if (mockScenario === 'datasource') {
          setValue('policyTreeName', 'prometheus-prod');
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          return;
        }
        if (mockScenario === 'schema-derived-secrets') {
          setValue('notificationsSource', 'yaml');
          setValue('policyTreeName', 'prometheus-prod');
          // YAML with Slack receiver: api_url is schema-marked secure but uses low-entropy value
          // (won't trigger entropy heuristic), so redaction depends solely on schema wiring.
          // channel is not in the schema-derived secrets map and won't be redacted.
          setValue(
            'notificationsYamlFile',
            new File(
              [
                'route:\n  receiver: slack-receiver\nreceivers:\n  - name: slack-receiver\n    slack_configs:\n      - api_url: https://example.slack.com/webhook\n        channel: "#alerts"\nglobal:\n  resolve_timeout: 5m\n',
              ],
              'alertmanager.yaml',
              { type: 'application/yaml' }
            )
          );
          setValue('notificationsTemplateFiles', [
            new File(['{{ define "email" }}{{ end }}'], 'email.tmpl', { type: 'text/plain' }),
            new File(['{{ define "slack" }}{{ end }}'], 'slack.tmpl', { type: 'text/plain' }),
          ]);
          return;
        }
        if (mockScenario === 'no-secrets') {
          setValue('notificationsSource', 'yaml');
          setValue('policyTreeName', 'prometheus-prod');
          setValue(
            'notificationsYamlFile',
            new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'alertmanager.yaml', {
              type: 'application/yaml',
            })
          );
          setValue('notificationsTemplateFiles', []);
          return;
        }
        if (mockScenario === 'flush-indented-yaml') {
          setValue('notificationsSource', 'yaml');
          setValue('policyTreeName', 'prometheus-prod');
          // Sequence dashes flush with their parent key — a valid YAML style that differs from
          // js-yaml dump()'s own default (extra-indented dashes), to prove reveal/hide doesn't
          // reflow the document's structure.
          setValue(
            'notificationsYamlFile',
            new File(
              [
                'route:\n  receiver: default-email\n  routes:\n  - matchers:\n    - severity=critical\n    receiver: escalate-pagerduty\nreceivers:\n  - name: default-email\n  - name: escalate-pagerduty\n    slack_configs:\n      - api_url: https://hooks.slack.com/services/9f3kLm2QpXz7Tr5Vb8Nc1Wd4Yh6Ag0Ee\n',
              ],
              'alertmanager.yaml',
              { type: 'application/yaml' }
            )
          );
          setValue('notificationsTemplateFiles', []);
          return;
        }
        setValue('notificationsSource', 'yaml');
        setValue('policyTreeName', 'prometheus-prod');
        setValue(
          'notificationsYamlFile',
          new File(
            [
              'route:\n  receiver: default\nreceivers:\n  - name: default\nglobal:\n  smtp_auth_password: hunter2wayTooSimpleButStillAKey123\n',
            ],
            'alertmanager.yaml',
            { type: 'application/yaml' }
          )
        );
        setValue('notificationsTemplateFiles', [
          new File(['{{ define "email" }}{{ end }}'], 'email.tmpl', { type: 'text/plain' }),
          new File(['{{ define "slack" }}{{ end }}'], 'slack.tmpl', { type: 'text/plain' }),
        ]);
      }, [setValue, getValues]);
      if (mockScenario === 'auto-sync' || mockScenario === 'auto-sync-custom-name') {
        return null;
      }
      return <input placeholder="prometheus-prod" {...register('policyTreeName')} />;
    },
    useStep1Validation: () => true,
    // The name auto-sync picks for the mocked Mimir datasource.
    usePredictedAutoSyncIdentifier: (autoSyncActive: boolean) => (autoSyncActive ? 'mimir-alertmanager' : undefined),
  };
});
// Most flows skip Rules, which needs the step left empty: its single button only skips while no rules
// source is chosen. A test that completes the step instead turns mockSeedRulesSource on, so
// handleConfirmImport has the rulesDatasourceUID it needs to fire the import. The 'yaml' scenario seeds a
// rules YAML upload instead, for tests that exercise the rules preview.
let mockRulesScenario: 'datasource' | 'datasource-filtered' | 'yaml' = 'datasource';
let mockSeedRulesSource = false;

jest.mock('./steps/Step2AlertRules', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step2Content: function Step2Content() {
      const { setValue } = useFormContext();
      useEffect(() => {
        if (mockRulesScenario === 'yaml') {
          setValue('rulesSource', 'yaml');
          setValue(
            'rulesYamlFile',
            new File(
              [
                'groups:\n  - name: g\n    rules:\n      - alert: HighErrorRate\n        expr: up == 0\n        annotations:\n          runbook_url: https://runbooks.example.com/incident/AbCdEfGh12345678\n',
              ],
              'rules.yaml',
              { type: 'application/yaml' }
            )
          );
          return;
        }
        if (mockRulesScenario === 'datasource-filtered') {
          setValue('rulesSource', 'datasource');
          setValue('rulesDatasourceUID', 'prometheus-uid');
          setValue('rulesDatasourceName', 'Prometheus');
          setValue('namespace', 'ns-a');
          setValue('ruleGroup', 'group-a');
          return;
        }
        if (mockSeedRulesSource) {
          setValue('rulesDatasourceUID', 'prometheus-uid');
        }
      }, [setValue]);
      return null;
    },
    useStep2Validation: () => true,
  };
});

const CONVERT_URL = '/api/convert/api/v1/alerts';

const server = setupMswServer();

const mockReportInteraction = jest.mocked(reportInteraction);

testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

// The wizard locks its notifications step unless the Alertmanager import API is on.
beforeEach(() => setTestFlags({ [FlagKeys.AlertingImportAlertmanagerAPI]: true }));
// The reset fires OpenFeature events while components are still mounted, so it needs act.
afterEach(async () => {
  await act(async () => {
    setTestFlags();
  });
});

beforeEach(() => {
  mockScenario = 'yaml';
  mockSeedRulesSource = false;
  mockReportInteraction.mockClear();
  // Default: the notifications import succeeds. Individual tests override this to force a failure.
  server.use(http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())));
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingProvisioningSetStatus,
    // useAutoSyncConfiguration (saveAutoSync) gates its Config query on this permission.
    AccessControlAction.ActionAlertingNotificationsConfigRead,
  ]);
  // useAutoSyncConfiguration (called directly by the wizard for saveAutoSync) fires this
  // unconditionally, independent of the mocked Step1Content above.
  setupDatasourcesEndpoint(server, []);
  locationService.push('/');
});

/**
 * Drives the wizard: complete the notifications step, skip the rules step, then open and accept the
 * confirm modal. Leaves the rest to the caller's assertions.
 */
async function importWith(user: ReturnType<typeof render>['user']) {
  await screen.findByRole('group', { name: /import notification configuration/i });
  // Notifications -> Rules: the stub triggers a dry-run; wait for it to pass so Next is enabled
  // (Next is gated on a passing dry-run, and is disabled while blocked). Re-query each poll — the
  // button node is replaced when its disabled-state tooltip wrapper is removed on enable.
  await waitFor(
    () =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      ),
    {
      timeout: 3000,
    }
  );
  await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
  await screen.findByRole('group', { name: /import rules/i });
  // Skip Rules -> Review
  await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
  // Review -> open confirm modal
  await user.click(await screen.findByRole('button', { name: /start import/i }));
  // Confirm inside the modal
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /start import/i }));
}

describe('ImportWizardGate — gating on mount', () => {
  it('locks the notifications step when auto-sync is already active on mount', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

    render(<ImportWizardGate />);

    expect(await screen.findByText(/auto-sync is enabled/i)).toBeInTheDocument();
    // The locked step has nothing to skip, it only offers to continue.
    expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
      'aria-disabled',
      'false'
    );
    expect(screen.queryByTestId(selectors.pages.Alerting.ImportToGMA.skipButton)).not.toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — opened on the rules step', () => {
  it('starts on the rules step and can move on to the review from there', async () => {
    const { user } = render(<ImportWizardGate />, {
      historyOptions: { initialEntries: ['/alerting/import-to-gma?step=rules'] },
    });

    expect(await screen.findByRole('group', { name: /import rules/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /import notification configuration/i })).not.toBeInTheDocument();

    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    expect(await screen.findByText(/review import/i)).toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — stage analytics', () => {
  it('tracks success and lands on the Import settings tab', async () => {
    const { user } = render(<ImportWizardGate />);

    await importWith(user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ notificationsSource: 'yaml' })
      )
    );
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/admin/import'), {
      timeout: 3000,
    });
  });

  it('tracks an error when the import fails', async () => {
    // Only fail the real import — the dry-run (same URL, distinguished by the dry-run header) must
    // still pass so the wizard can advance to the confirm step under the passing-dry-run gate.
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? HttpResponse.json(convertResponse())
          : new HttpResponse(null, { status: 500 })
      )
    );
    const { user } = render(<ImportWizardGate />);

    await importWith(user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'yaml' })
      )
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(locationService.getLocation().pathname).not.toContain('/alerting/list');
  });

  it('shows what the failed import reported in the modal, without a toast', async () => {
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? HttpResponse.json({ status: 'success' })
          : HttpResponse.json({ message: 'unsupported scheme "" for URL' }, { status: 500 })
      )
    );
    const emitSpy = jest.spyOn(appEvents, 'emit');
    const store = configureStore();
    const { user } = render(<ImportWizardGate />, { store });

    await importWith(user);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/unsupported scheme "" for URL/)).toBeInTheDocument();
    // backendSrv raises its global toast 50ms after a failed request settles, so wait for it before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(emitSpy).not.toHaveBeenCalledWith(AppEvents.alertError, expect.anything());
    expect(emitSpy).not.toHaveBeenCalledWith(AppEvents.alertWarning, expect.anything());
    expect(Object.values(store.getState().appNotifications.byId)).toHaveLength(0);
    emitSpy.mockRestore();
  });

  it('shows the confirmation again, not the old error, after closing a failed import and reopening it', async () => {
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? HttpResponse.json(convertResponse())
          : HttpResponse.json({ message: 'unsupported scheme "" for URL' }, { status: 500 })
      )
    );
    const { user } = render(<ImportWizardGate />);

    await importWith(user);
    expect(await within(await screen.findByRole('dialog')).findByText(/unsupported scheme/)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /start import/i }));

    const reopened = await screen.findByRole('dialog');
    expect(within(reopened).getByText(/are you sure you want to start the import/i)).toBeInTheDocument();
    expect(within(reopened).queryByText(/unsupported scheme/)).not.toBeInTheDocument();
  });

  it('keeps the confirmation open while the import is running', async () => {
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? HttpResponse.json(convertResponse())
          : new Promise<Response>(() => {})
      )
    );
    const { user } = render(<ImportWizardGate />);

    await importWith(user);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Importing...')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('imports only rules when notifications are skipped, then toasts and goes to the rule list', async () => {
    mockScenario = 'empty';
    mockSeedRulesSource = true;
    server.use(http.post('/api/convert/prometheus/config/v1/rules', () => HttpResponse.json(convertResponse())));
    const store = configureStore();
    const { user } = render(<ImportWizardGate />, { store });

    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await user.click(await screen.findByRole('button', { name: /start import/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start import/i }));

    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/list'), {
      timeout: 3000,
    });
    expect(Object.values(store.getState().appNotifications.byId).map((notification) => notification.title)).toContain(
      'Successfully imported resources to Grafana Alerting.'
    );
    expect(locationService.getLocation().pathname).not.toContain('/alerting/admin/import');
  });
});

describe('ImportToGMA wizard — step 1 dry-run gating & review', () => {
  it('runs a fresh dry-run when Next is clicked and blocks navigation when it fails', async () => {
    // Fail the dry-run itself, so the click-time check never passes.
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(convertResponse())
      )
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    // Next is available immediately — the check happens on click, not while typing.
    const nextButton = screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton);
    expect(nextButton).toHaveAttribute('aria-disabled', 'false');

    await user.click(nextButton);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error')
    );
    expect(screen.queryByRole('group', { name: /import rules/i })).not.toBeInTheDocument();
    // The failed check doesn't permanently lock the step — Next stays clickable for a retry.
    expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
      'aria-disabled',
      'false'
    );
  });

  it('lists the uploaded template files in the review step', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    // Notifications -> Rules (wait for the seeded dry-run to pass; re-query — the button node is
    // replaced when its disabled-state tooltip wrapper is removed on enable).
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      {
        timeout: 3000,
      }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // Skip Rules -> Review
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    // The review notifications card lists the uploaded template files by name.
    expect(await screen.findByText('email.tmpl, slack.tmpl')).toBeInTheDocument();
  });

  it("opens the matching preview modal from each card's Preview button on the review step", async () => {
    mockSeedRulesSource = true;
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // Complete Rules instead of skipping it, so its card also renders a Preview control on Review.
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    // aria-label disambiguates the two cards' otherwise-identical "Preview" buttons.
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));
    const notificationsDialog = await screen.findByRole('dialog', { name: /notifications config preview/i });
    await screen.findByRole('textbox', { name: /notifications config preview/i });
    expect(jest.mocked(CodeMirrorEditor).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ height: '500px', language: 'yaml', readOnly: true, lineWrapping: true })
    );
    // Modal renders both its own close-icon button and the explicit "Close" button below the content.
    const closeButtons = within(notificationsDialog).getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);

    await user.click(await screen.findByRole('button', { name: /preview alert rules/i }));
    expect(await screen.findByRole('dialog', { name: /alert rules preview/i })).toBeInTheDocument();
  });

  it('does not render a secret from the uploaded YAML in the notifications preview', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      {
        timeout: 3000,
      }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // The rules step is left empty, so its one button skips it.
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    expect(editor.value).not.toContain('hunter2wayTooSimpleButStillAKey123');
    expect(editor.value).toContain('receiver: default');
  });
});

describe('ImportToGMA wizard — datasource-fetch preview redaction', () => {
  beforeEach(() => {
    mockScenario = 'datasource';
    setupDataSources(mockDataSource({ uid: 'mimir-uid', name: 'Mimir Alertmanager', type: 'alertmanager' }));
  });

  afterEach(() => {
    mockScenario = 'yaml';
    setupDataSources();
  });

  it('does not render a secret fetched from an external Alertmanager in the notifications preview', async () => {
    server.use(
      http.get('/api/alertmanager/mimir-uid/config/api/v1/alerts', () =>
        HttpResponse.json({
          template_files: {},
          alertmanager_config: {
            route: { receiver: 'default' },
            receivers: [
              { name: 'default', pagerduty_configs: [{ routing_key: 'hunter2wayTooSimpleButStillAKey123' }] },
            ],
          },
        })
      )
    );

    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      {
        timeout: 3000,
      }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // The rules step is left empty, so its one button skips it.
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    expect(editor.value).not.toContain('hunter2wayTooSimpleButStillAKey123');
    expect(editor.value).toContain('"receiver": "default"');
    expect(jest.mocked(CodeMirrorEditor).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ height: '500px', language: 'json', readOnly: true, lineWrapping: true })
    );
  });

  it('does not reopen the notifications preview after it is dismissed while still loading', async () => {
    // The step 1 dry-run also fetches this same endpoint — let that first call resolve
    // immediately; only the later, preview-triggered call (installed below) is gated.
    server.use(
      http.get('/api/alertmanager/mimir-uid/config/api/v1/alerts', () =>
        HttpResponse.json({
          template_files: {},
          alertmanager_config: { route: { receiver: 'default' }, receivers: [{ name: 'default' }] },
        })
      )
    );

    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // The rules step is left empty, so its one button skips it.
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    let handlerResolved = false;
    let resolveFetch: () => void = () => {};
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    server.use(
      http.get('/api/alertmanager/mimir-uid/config/api/v1/alerts', async () => {
        await fetchGate;
        handlerResolved = true;
        return HttpResponse.json({
          template_files: {},
          alertmanager_config: { route: { receiver: 'default' }, receivers: [{ name: 'default' }] },
        });
      })
    );

    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));
    const dialog = await screen.findByRole('dialog', { name: /notifications config preview/i });

    // The fetch above is still pending (gated on fetchGate) — dismiss now, while still loading.
    expect(within(dialog).getByText('Loading content...')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    const closeButtons = within(dialog).getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByRole('dialog', { name: /notifications config preview/i })).not.toBeInTheDocument();

    // Let the in-flight fetch resolve now that the modal has been dismissed — it must stay closed.
    resolveFetch();
    await waitFor(() => expect(handlerResolved).toBe(true));
    expect(screen.queryByRole('dialog', { name: /notifications config preview/i })).not.toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — preview redaction with schema-derived secrets', () => {
  /**
   * Drives the wizard from the notifications step through to the Review step, without opening any
   * preview or confirm modal — leaves that to the caller.
   */
  async function navigateToReview(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // The rules step is left empty, so its one button skips it.
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
  }

  it('disables the Preview buttons while schemas are loading', async () => {
    // Delay the schema response indefinitely (override the legacy endpoint)
    server.use(
      http.get('/api/alert-notifiers', () => new Promise(() => {})) // Never resolves
    );
    const { user } = render(<ImportWizardGate />);

    await navigateToReview(user);

    // Schemas are stuck loading; Preview buttons should be disabled
    const previewButtons = screen.getAllByRole('button', { name: /preview/i });
    expect(previewButtons).toHaveLength(1); // Only notifications card shows Preview
    expect(previewButtons[0]).toBeDisabled();
  });

  it('shows redaction error message and does not fetch any content when schema fetch fails', async () => {
    // Override the legacy API endpoint to return an error (since the feature flag is not enabled by default)
    server.use(http.get('/api/alert-notifiers', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })));
    const { user } = render(<ImportWizardGate />);

    await navigateToReview(user);

    // Open the preview
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    // Should show the redaction error, not raw content
    expect(editor.value).toContain('This configuration could not be safely previewed');
    expect(editor.value).not.toContain('hunter2wayTooSimpleButStillAKey123');
  });

  it('redacts schema-derived secrets from preview', async () => {
    // Override the legacy endpoint to return schema data with versions and secure fields.
    // This replaces the default mock which has no versions field (only top-level options).
    // By verifying that redaction works with schema-derived data, this test proves the hook
    // wiring and secretFieldMap are functional.
    server.use(
      http.get('/api/alert-notifiers', () => {
        return HttpResponse.json([
          {
            type: 'slack',
            name: 'Slack',
            heading: 'Slack',
            description: 'Send alerts to Slack',
            info: '',
            currentVersion: 'v0mimir1',
            deprecated: false,
            // versions is the key difference - it makes buildSecretFieldMap derive the secret map
            versions: [
              {
                version: 'v0mimir1',
                label: 'v0mimir1',
                description: '',
                canCreate: true,
                deprecated: false,
                options: [
                  {
                    propertyName: 'api_url',
                    label: 'Webhook URL',
                    description: 'Slack webhook URL',
                    element: 'input',
                    inputType: 'password',
                    required: true,
                    secure: true,
                    protected: false,
                    selectOptions: null,
                    showWhen: { field: '', is: '' },
                    validationRule: '',
                  },
                  {
                    propertyName: 'channel',
                    label: 'Channel',
                    description: 'Slack channel',
                    element: 'input',
                    inputType: 'text',
                    required: false,
                    secure: false,
                    protected: false,
                    selectOptions: null,
                    showWhen: { field: '', is: '' },
                    validationRule: '',
                  },
                ],
              },
            ],
          },
        ]);
      })
    );

    mockScenario = 'schema-derived-secrets';

    const { user } = render(<ImportWizardGate />);

    try {
      await navigateToReview(user);
      await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

      const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
      // The schema marks api_url as secure. It should be redacted even though the value
      // (https://example.slack.com/webhook) is low-entropy and wouldn't match the entropy heuristic.
      // This proves the redaction came from the schema-derived secretFieldMap, not the heuristic.
      expect(editor.value).not.toContain('https://example.slack.com/webhook');
      expect(editor.value).toContain('<redacted>');
      // channel is not marked secure in the schema and does not match the entropy heuristic,
      // so it must NOT be redacted. This proves we're not blanket-redacting.
      expect(editor.value).toContain('#alerts');

      // Reveal secrets — the real value must show up in the same editor.
      await user.click(screen.getByRole('button', { name: /reveal secrets/i }));
      expect(editor.value).toContain('https://example.slack.com/webhook');
      expect(editor.value).not.toContain('<redacted>');

      // Hide again — back to redacted.
      await user.click(screen.getByRole('button', { name: /hide secrets/i }));
      expect(editor.value).toContain('<redacted>');
      expect(editor.value).not.toContain('https://example.slack.com/webhook');
    } finally {
      mockScenario = 'yaml';
    }
  });
});

describe('ImportToGMA wizard — reveal/hide secrets toggle', () => {
  async function navigateToReview(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    // The rules step is left empty, so its one button skips it.
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
  }

  afterEach(() => {
    mockScenario = 'yaml';
  });

  it('disables the reveal control when nothing was redacted, with a tooltip explaining why', async () => {
    mockScenario = 'no-secrets';
    const { user } = render(<ImportWizardGate />);

    await navigateToReview(user);
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    await screen.findByTestId('code-editor');
    const revealButton = screen.getByRole('button', { name: /reveal secrets/i });
    expect(revealButton).toBeDisabled();

    await user.hover(revealButton);
    expect(await screen.findByText(/nothing was redacted in this configuration/i)).toBeInTheDocument();
  });

  it('reopens the preview hidden after being closed while revealed', async () => {
    const { user } = render(<ImportWizardGate />);

    await navigateToReview(user);
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    let editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    expect(editor.value).toContain('<redacted>');

    await user.click(screen.getByRole('button', { name: /reveal secrets/i }));
    expect(editor.value).toContain('hunter2wayTooSimpleButStillAKey123');

    const dialog = screen.getByRole('dialog', { name: /notifications config preview/i });
    const closeButtons = within(dialog).getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByRole('dialog', { name: /notifications config preview/i })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));
    editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    expect(editor.value).toContain('<redacted>');
    expect(editor.value).not.toContain('hunter2wayTooSimpleButStillAKey123');
  });

  it('does not reflow the document structure when toggling reveal, even with flush-indented sequences', async () => {
    mockScenario = 'flush-indented-yaml';
    const { user } = render(<ImportWizardGate />);

    await navigateToReview(user);
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    // Redacted: the uploaded file's flush-indented "- severity=critical" line normalizes to
    // js-yaml dump()'s own (extra-indented) style.
    expect(editor.value).toContain('- matchers:\n        - severity=critical\n');

    await user.click(screen.getByRole('button', { name: /reveal secrets/i }));
    // Revealed: same structural indentation as the redacted view — only the secret value
    // changed, proving the raw view was reformatted rather than shown verbatim.
    expect(editor.value).toContain('- matchers:\n        - severity=critical\n');
    expect(editor.value).toContain('https://hooks.slack.com/services/9f3kLm2QpXz7Tr5Vb8Nc1Wd4Yh6Ag0Ee');
  });
});

describe('ImportToGMA wizard — rules preview (no redaction)', () => {
  /**
   * Drives the wizard from notifications through to Review, completing (not skipping) the Rules
   * step so its card renders a Preview control.
   */
  async function navigateToReviewWithRulesCompleted(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
  }

  beforeEach(() => {
    mockRulesScenario = 'yaml';
  });

  afterEach(() => {
    mockRulesScenario = 'datasource';
  });

  it('shows raw rules content without redaction, even when it looks like a secret', async () => {
    const { user } = render(<ImportWizardGate />);

    await navigateToReviewWithRulesCompleted(user);
    await user.click(await screen.findByRole('button', { name: /preview alert rules/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    // A high-entropy-shaped URL segment like this would be redacted under the notifications
    // preview's schema+heuristic pipeline; the rules preview shows it unredacted since rule
    // content (expr/labels/annotations) has no secret-bearing fields.
    expect(editor.value).toContain('AbCdEfGh12345678');
  });

  it('does not disable the rules Preview button while notification schemas are still loading', async () => {
    // Delay the notifications schema fetch indefinitely — rules preview no longer depends on it.
    server.use(http.get('/api/alert-notifiers', () => new Promise(() => {})));
    const { user } = render(<ImportWizardGate />);

    await navigateToReviewWithRulesCompleted(user);

    expect(await screen.findByRole('button', { name: /preview alert rules/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /preview configuration/i })).toBeDisabled();
  });

  it('never renders a reveal control on the rules preview', async () => {
    const { user } = render(<ImportWizardGate />);

    await navigateToReviewWithRulesCompleted(user);
    await user.click(await screen.findByRole('button', { name: /preview alert rules/i }));

    await screen.findByTestId('code-editor');
    expect(screen.queryByRole('button', { name: /reveal secrets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hide secrets/i })).not.toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — auto-sync confirm flow', () => {
  beforeEach(() => {
    mockScenario = 'auto-sync';
    // The dry-run reads the configuration from the selected Alertmanager before checking it.
    setupDataSources(
      mockDataSource({ uid: 'mimir-uid', name: 'Mimir Alertmanager', type: DataSourceType.Alertmanager })
    );
    server.use(
      http.get('/api/alertmanager/:name/config/api/v1/alerts', () =>
        HttpResponse.json({
          template_files: {},
          alertmanager_config: { route: { receiver: 'default' }, receivers: [{ name: 'default' }] },
        })
      )
    );
  });

  afterEach(() => {
    mockScenario = 'yaml';
  });

  /** Notifications -> Rules (now always reachable, even with Auto-sync checked). */
  async function advanceToRules(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
  }

  it('still shows the Rules step when Auto-sync is checked, and lets it be skipped', async () => {
    const { user } = render(<ImportWizardGate />);

    await advanceToRules(user);

    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
    expect(screen.getByText(/will sync continuously/i)).toBeInTheDocument();
    // Both cards are in a static, non-interactive state here (auto-sync badge, Skipped) — neither
    // should render a Preview control.
    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
  });

  // A filled-in step can't be skipped, so an Auto-sync selection can't be left behind by a skip. Moving on
  // without it means unticking it first. isAutoSyncCommitted (steps.test.ts) still guards a skipped step.
  it('offers no skip once Auto-sync is selected, only continuing with it', async () => {
    setupStatefulAutoSyncConfig(server);

    render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    expect(screen.queryByTestId(selectors.pages.Alerting.ImportToGMA.skipButton)).not.toBeInTheDocument();
    expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveTextContent(/^continue$/i);
  });

  it('calls saveAutoSync (not the staging import) and tracks success when Rules is skipped', async () => {
    const { getStored } = setupStatefulAutoSyncConfig(server);
    let stagingImportCalled = false;
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        // The dry-run that checks the configuration goes to the same endpoint; only a real import counts.
        if (request.headers.get('X-Grafana-Alerting-Dry-Run') !== 'true') {
          stagingImportCalled = true;
        }
        return HttpResponse.json(convertResponse());
      })
    );

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    expect(screen.getByText(/will sync continuously/i)).toBeInTheDocument();
    expect(screen.getByText(/Mimir Alertmanager/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'mimir-uid' }));
    expect(stagingImportCalled).toBe(false);
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/admin/import'), {
      timeout: 3000,
    });
  });

  it('enables auto-sync and imports rules together when Rules is completed instead of skipped', async () => {
    mockSeedRulesSource = true;
    const { getStored } = setupStatefulAutoSyncConfig(server);
    let rulesImportCalled = false;
    server.use(
      // The rules import (convertApi's postRuleGroups) posts here,
      // a different endpoint from CONVERT_URL (notifications/dry-run only).
      http.post('/api/convert/prometheus/config/v1/rules', () => {
        rulesImportCalled = true;
        return HttpResponse.json(convertResponse());
      })
    );

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    // Step2Content renders null and useStep2Validation is stubbed true (see the mock above), so
    // Next is enabled immediately without needing the real rules-picking UI.
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'mimir-uid' }));
    expect(rulesImportCalled).toBe(true);
    await waitFor(() => expect(within(dialog).getByText(/alert rules were also imported/i)).toBeInTheDocument());
  });

  it('routes imported rules to the tree Auto-sync names, not the policy tree name typed earlier', async () => {
    mockScenario = 'auto-sync-custom-name';
    mockSeedRulesSource = true;
    setupStatefulAutoSyncConfig(server);
    let rulesRequestHeaders = '';
    server.use(
      http.post('/api/convert/prometheus/config/v1/rules', ({ request }) => {
        rulesRequestHeaders = JSON.stringify(Object.fromEntries(request.headers.entries()));
        return HttpResponse.json(convertResponse());
      })
    );

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() => expect(rulesRequestHeaders).not.toBe(''));
    expect(rulesRequestHeaders).toContain('mimir-alertmanager');
    expect(rulesRequestHeaders).not.toContain('typed-before-auto-sync');
  });

  it('reports a Rules-specific failure — not an Auto-sync failure — when Rules import fails after Auto-sync already succeeded', async () => {
    mockSeedRulesSource = true;
    const { getStored } = setupStatefulAutoSyncConfig(server);
    server.use(http.post('/api/convert/prometheus/config/v1/rules', () => new HttpResponse(null, { status: 500 })));

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    // Auto-sync's own save call succeeded even though the overall submit errors out below.
    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: 'mimir-uid' }));
    await waitFor(() => expect(within(dialog).getByText(/rules import failed/i)).toBeInTheDocument());
    expect(within(dialog).queryByText(/failed to enable auto-sync/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
  });

  it('tracks an error and does not fall through to the staging import path when saveAutoSync fails', async () => {
    setupStatefulAutoSyncConfig(server);
    setupAutoSyncConfigWriteError(server, { code: 500, message: 'failed to save the configuration' });

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(within(dialog).getByText(/failed to enable auto-sync/i)).toBeInTheDocument();
  });

  it('reports an error and does not fall through to the staging import path when the Config singleton has not been seeded yet', async () => {
    // Humans can't create the Config singleton — this is the pre-seed state, not a write failure.
    setupAutoSyncConfigAbsent(server);

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(within(dialog).getByText(/failed to enable auto-sync/i)).toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — checking the configuration on its own', () => {
  // Records the policy tree name each dry run was sent with.
  function recordDryRuns() {
    const names: Array<string | null> = [];
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        if (request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true') {
          names.push(request.headers.get('X-Grafana-Alerting-Config-Identifier'));
        }
        return HttpResponse.json({ status: 'success' });
      })
    );
    return names;
  }

  afterEach(() => {
    mockScenario = 'yaml';
    setupDataSources();
  });

  it('checks the configuration as soon as a data source is picked, without a policy tree name', async () => {
    mockScenario = 'datasource-unnamed';
    setupDataSources(mockDataSource({ uid: 'mimir-uid', name: 'Mimir Alertmanager', type: 'alertmanager' }));
    server.use(
      http.get('/api/alertmanager/mimir-uid/config/api/v1/alerts', () =>
        HttpResponse.json({
          template_files: {},
          alertmanager_config: { route: { receiver: 'default' }, receivers: [{ name: 'default' }] },
        })
      )
    );
    const names = recordDryRuns();

    render(<ImportWizardGate />);

    // The generated client always sends the header. Empty makes the backend use its default name.
    await waitFor(() => expect(names).toEqual(['']));
  });

  it('does not rerun the check while the policy tree name is typed', async () => {
    const names = recordDryRuns();
    const { user } = render(<ImportWizardGate />);
    await waitFor(() => expect(names).toEqual(['prometheus-prod']));

    await user.type(screen.getByPlaceholderText('prometheus-prod'), '-2');
    // Longer than the check's debounce, so a rerun would have been sent by now.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    expect(names).toEqual(['prometheus-prod']);
  });
});

describe('dry-run wiring (wizard-level)', () => {
  beforeEach(() => {
    mockScenario = 'yaml';
  });

  it('keeps Next enabled while editing, and checks the latest value when clicked', async () => {
    const identifiersSeen: Array<string | null> = [];
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        identifiersSeen.push(request.headers.get('X-Grafana-Alerting-Config-Identifier'));
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });

    const input = screen.getByPlaceholderText(/prometheus-prod/i);
    await user.type(input, '2');

    // Editing the (still-valid) name never disables Next — there's nothing to "wait out" anymore.
    const nextButton = screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton);
    expect(nextButton).toHaveAttribute('aria-disabled', 'false');

    await user.click(nextButton);
    await screen.findByRole('group', { name: /import rules/i });

    // Whatever the debounced preview checked along the way, the click-time check used the
    // current, fully-edited value.
    expect(identifiersSeen.at(-1)).toBe('prometheus-prod2');
  });

  it('routes imported rules to the policy tree name from the latest Next, not an earlier one', async () => {
    mockSeedRulesSource = true;
    let rulesRequestHeaders = '';
    server.use(
      http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())),
      http.post('/api/convert/prometheus/config/v1/rules', ({ request }) => {
        rulesRequestHeaders = request.headers.get('X-Grafana-Alerting-Notification-Settings') ?? '';
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId('wizard-prev-button'));
    await user.type(await screen.findByPlaceholderText(/prometheus-prod/i), '-2');
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await user.click(await screen.findByRole('button', { name: /start import/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start import/i }));

    await waitFor(() => expect(rulesRequestHeaders).not.toBe(''));
    expect(rulesRequestHeaders).toContain('prometheus-prod-2');
  });

  it('disables the step 1 inputs while the click-time check runs, then re-enables them on failure', async () => {
    let previewDone = false;
    let failCheck: (() => void) | undefined;
    server.use(
      http.post(CONVERT_URL, async () => {
        if (!previewDone) {
          previewDone = true;
          return HttpResponse.json(convertResponse());
        }
        await new Promise<void>((resolve) => {
          failCheck = resolve;
        });
        return new HttpResponse(null, { status: 500 });
      })
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(() => expect(previewDone).toBe(true));

    const input = screen.getByPlaceholderText(/prometheus-prod/i);
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    await waitFor(() => expect(input).toBeDisabled());
    failCheck?.();
    await waitFor(() => expect(input).toBeEnabled());
  });

  it('tracks the dry-run outcome once per Next click, not for each debounced preview', async () => {
    let requestCount = 0;
    server.use(
      http.post(CONVERT_URL, () => {
        requestCount += 1;
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await waitFor(() => expect(requestCount).toBe(1));

    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });

    expect(requestCount).toBe(2);
    expect(
      mockReportInteraction.mock.calls.filter(([name]) => name === 'grafana_alerting_import_to_gma_dryrun_success')
    ).toHaveLength(1);
  });

  it('blocks jumping to Review after editing a completed Step 1 until Next re-validates it', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    await user.click(screen.getByRole('button', { name: /notification configuration/i }));
    await screen.findByRole('group', { name: /import notification configuration/i });
    // Untouched, the completed steps still allow jumping straight to Review.
    expect(screen.getByRole('button', { name: /review & import/i })).toBeEnabled();

    await user.type(screen.getByPlaceholderText(/prometheus-prod/i), '2');
    expect(screen.getByRole('button', { name: /review & import/i })).toBeDisabled();

    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
  });

  it('does not disable Next when navigating back to a Step 1 that is already valid', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())));
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
      'aria-disabled',
      'false'
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    await screen.findByRole('group', { name: /import rules/i });
    // PreviousButton has no e2e-selector entry; it renders a plain data-testid.
    await user.click(screen.getByTestId('wizard-prev-button'));

    // No waitFor: Next's enablement depends only on form validity, which persists across
    // navigation — there's no cached dry-run state that could be reset or re-triggered on remount.
    await screen.findByRole('group', { name: /import notification configuration/i });
    expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
      'aria-disabled',
      'false'
    );
  });

  it('validates the current value on click, unaffected by a slow, superseded preview request', async () => {
    let resolveStalePreview: (() => void) | undefined;
    let requestCount = 0;
    server.use(
      http.post(CONVERT_URL, async () => {
        requestCount += 1;
        if (requestCount === 1) {
          // The initial (pre-edit) debounced preview — never resolves until told to.
          await new Promise<void>((resolve) => {
            resolveStalePreview = resolve;
          });
        }
        return HttpResponse.json(convertResponse());
      })
    );

    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification configuration/i });
    // Wait for the initial preview request to actually start before editing away from it.
    await waitFor(() => expect(requestCount).toBe(1));

    const input = screen.getByPlaceholderText(/prometheus-prod/i);
    await user.type(input, '-changed');

    // Click Next while the stale preview for the old value is still hanging.
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    resolveStalePreview?.();

    // Next's own click-time check (for the edited value) isn't blocked by the still-pending,
    // now-irrelevant preview request for the old one.
    await screen.findByRole('group', { name: /import rules/i });
  });
});

describe('dry-run outcomes (wizard-level)', () => {
  async function clickNextOnStep1(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification configuration/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
  }

  it('tracks renamed resources and carries on to Review, which lists them', async () => {
    server.use(
      http.post(CONVERT_URL, () =>
        HttpResponse.json(
          convertResponse({
            rename_resources: { receivers: { 'team-email': 'team-email-1', pager: 'pager-1' }, time_intervals: {} },
          })
        )
      )
    );
    const { user } = render(<ImportWizardGate />);

    await clickNextOnStep1(user);
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_warning', {
      renamedReceiversCount: 2,
      renamedTimeIntervalsCount: 0,
    });
    expect(screen.getByText(/some resources will be renamed/i)).toBeInTheDocument();
    await user.click(screen.getByText(/2 contact points will be renamed/i));
    expect(screen.getByText('team-email-1')).toBeInTheDocument();
  });

  it('tracks an error and stays on step 1 when the check answers 200 but is not a success', async () => {
    server.use(
      http.post(CONVERT_URL, () =>
        HttpResponse.json(convertResponse({ status: 'error', error: 'template conflict', errorType: 'bad_data' }))
      )
    );
    const { user } = render(<ImportWizardGate />);

    await clickNextOnStep1(user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error')
    );
    expect(screen.queryByRole('group', { name: /import rules/i })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /import notification configuration/i })).toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — data source rules with a namespace and group filter', () => {
  const rule = (alert: string, labels?: Record<string, string>) => ({ alert, expr: 'up == 0', labels });

  beforeEach(() => {
    mockScenario = 'empty';
    mockRulesScenario = 'datasource-filtered';
    // Reading a data source's rules needs the external-rules permission on top of the wizard's.
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsWrite,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingProvisioningSetStatus,
      AccessControlAction.ActionAlertingNotificationsConfigRead,
    ]);
    setupDataSources(
      mockDataSource({ uid: 'prometheus-uid', name: 'Prometheus', type: 'prometheus' }, { alerting: true })
    );
    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
        HttpResponse.json({ status: 'success', data: { version: '2.0.0', features: { ruler_config_api: 'true' } } })
      ),
      http.get('/api/ruler/prometheus-uid/api/v1/rules', () =>
        HttpResponse.json({
          'ns-a': [
            { name: 'group-a', rules: [rule('Kept'), rule('PluginManaged', { __grafana_origin: 'plugin' })] },
            { name: 'group-b', rules: [rule('OtherGroup')] },
          ],
          'ns-b': [{ name: 'group-a', rules: [rule('OtherNamespace')] }],
        })
      )
    );
  });

  afterEach(() => {
    mockRulesScenario = 'datasource';
  });

  it('counts, previews and sends the same filtered rules', async () => {
    let postedBody: unknown;
    server.use(
      http.post('/api/convert/prometheus/config/v1/rules', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    expect(await screen.findByText('Will import 1 rules')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /preview alert rules/i }));
    const preview = (await screen.findByTestId<HTMLTextAreaElement>('code-editor')).value;
    expect(preview).toContain('Kept');
    expect(preview).not.toMatch(/PluginManaged|OtherGroup|OtherNamespace/);
    await user.keyboard('{Escape}');

    await user.click(await screen.findByRole('button', { name: /start import/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start import/i }));

    await waitFor(() => expect(postedBody).toBeDefined());
    expect(JSON.stringify(postedBody)).toContain('Kept');
    expect(JSON.stringify(postedBody)).not.toMatch(/PluginManaged|OtherGroup|OtherNamespace/);
    expect(JSON.parse(preview)).toEqual(postedBody);
  });
});
