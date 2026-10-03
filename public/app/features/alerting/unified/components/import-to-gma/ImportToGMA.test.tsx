import { HttpResponse, http } from 'msw';
import * as React from 'react';
import { render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { type CodeEditor } from '@grafana/ui';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  setupAutoSyncConfig,
  setupAutoSyncConfigAbsent,
  setupAutoSyncConfigWriteError,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';

import { ImportWizardGate } from './ImportToGMA';

// Spread requireActual so config/locationService/feature-toggle reads stay real; only stub the
// analytics sink so we can assert the reported payload.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Monaco doesn't render usable content in jsdom — stub it with a plain textarea (same pattern as
// Templates.test.tsx) so the redacted preview content can be asserted on directly.
type CodeEditorProps = React.ComponentProps<typeof CodeEditor>;
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: CodeEditorProps) => <textarea data-testid="code-editor" value={value} readOnly />,
}));

// Selects which fixture the mocked Step1Content below seeds. Prefixed `mock` per Jest's rule for
// variables referenced from inside a jest.mock factory. Each describe block resets it in its own setup.
let mockScenario:
  | 'yaml'
  | 'auto-sync'
  | 'datasource'
  | 'schema-derived-secrets'
  | 'no-secrets'
  | 'flush-indented-yaml' = 'yaml';

// Seeds one of three notifications sources: YAML upload, a plain external datasource, or an
// Auto-sync-checked datasource. Next is gated on a passing dry-run except under Auto-sync (which
// skips it entirely), so both the YAML and plain-datasource branches set a policy tree name and
// call onTriggerDryRun — without a policy tree name the real handler no-ops and Next never
// enables. The real step body pulls in network-backed pickers we don't need — the assertion
// target is handleConfirmImport's behavior, not the step UI.
jest.mock('./steps/Step1AlertmanagerResources', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step1Content: function Step1Content({ onTriggerDryRun }: { onTriggerDryRun?: () => void }) {
      const { setValue } = useFormContext();
      useEffect(() => {
        if (mockScenario === 'auto-sync') {
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          setValue('autoSyncNotificationsEnabled', true);
          return;
        }
        if (mockScenario === 'datasource') {
          setValue('policyTreeName', 'prometheus-prod');
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          queueMicrotask(() => onTriggerDryRun?.());
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
          queueMicrotask(() => onTriggerDryRun?.());
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
          queueMicrotask(() => onTriggerDryRun?.());
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
          queueMicrotask(() => onTriggerDryRun?.());
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
        // Mounting on the wizard's very first render (Notifications is now step one), these setValue
        // calls aren't guaranteed to be visible via getValues() yet within the same tick — defer so
        // handleTriggerDryRun reads the values above rather than the stale defaults.
        queueMicrotask(() => onTriggerDryRun?.());
      }, [setValue, onTriggerDryRun]);
      return null;
    },
    useStep1Validation: () => true,
  };
});
// Most flows skip Rules, so this rarely matters. When a test completes the step instead,
// handleConfirmImport needs rulesDatasourceUID set to fire the import — seeding it here is
// harmless for the skip flows. The 'yaml' scenario seeds a rules YAML upload instead, for tests
// that exercise the rules preview.
let mockRulesScenario: 'datasource' | 'yaml' = 'datasource';

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
        setValue('rulesDatasourceUID', 'prometheus-uid');
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

beforeEach(() => {
  mockReportInteraction.mockClear();
  // Default: the notifications import succeeds. Individual tests override this to force a failure.
  server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'success' })));
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
  await screen.findByRole('group', { name: /import notification resources/i });
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
  await screen.findByRole('group', { name: /import alert rules/i });
  // Skip Rules -> Review
  await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
  // Review -> open confirm modal
  await user.click(await screen.findByRole('button', { name: /start import/i }));
  // Confirm inside the modal
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /start import/i }));
}

describe('ImportWizardGate — gating on mount', () => {
  it('blocks the wizard when auto-sync is already active, even before the Config query resolves', async () => {
    setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

    render(<ImportWizardGate />);

    expect(await screen.findByText(/auto-sync is enabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /import notification resources/i })).not.toBeInTheDocument();
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
          ? HttpResponse.json({ status: 'success' })
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
});

describe('ImportToGMA wizard — step 1 dry-run gating & review', () => {
  it('keeps the notifications-step Next disabled when the dry-run fails', async () => {
    // Fail the dry-run itself, so the step never reaches a passing validation state.
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ status: 'success' })
      )
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });

    // The dry-run runs and fails; Next stays disabled (aria-disabled keeps the tooltip reachable).
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error')
    );
    const nextButton = screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton);
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');

    // Clicking a blocked Next must not advance to the rules step.
    await user.click(nextButton);
    expect(screen.queryByRole('group', { name: /import alert rules/i })).not.toBeInTheDocument();
  });

  it('lists the uploaded template files in the review step', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });
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
    await screen.findByRole('group', { name: /import alert rules/i });
    // Skip Rules -> Review
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));

    // The review notifications card lists the uploaded template files by name.
    expect(await screen.findByText('email.tmpl, slack.tmpl')).toBeInTheDocument();
  });

  it("opens the matching preview modal from each card's Preview button on the review step", async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
    // Complete Rules instead of skipping it, so its card also renders a Preview control on Review.
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    // aria-label disambiguates the two cards' otherwise-identical "Preview" buttons.
    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));
    const notificationsDialog = await screen.findByRole('dialog', { name: /notifications config preview/i });
    // Modal renders both its own close-icon button and the explicit "Close" button below the content.
    const closeButtons = within(notificationsDialog).getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[closeButtons.length - 1]);

    await user.click(await screen.findByRole('button', { name: /preview alert rules/i }));
    expect(await screen.findByRole('dialog', { name: /alert rules preview/i })).toBeInTheDocument();
  });

  it('does not render a secret from the uploaded YAML in the notifications preview', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });
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
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));

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

    await screen.findByRole('group', { name: /import notification resources/i });
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
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));

    await user.click(await screen.findByRole('button', { name: /preview configuration/i }));

    const editor = await screen.findByTestId<HTMLTextAreaElement>('code-editor');
    expect(editor.value).not.toContain('hunter2wayTooSimpleButStillAKey123');
    expect(editor.value).toContain('"receiver": "default"');
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

    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
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
    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
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
    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
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
    expect(await screen.findByText(/no secrets were found in this configuration/i)).toBeInTheDocument();
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
    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      { timeout: 3000 }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
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
  });

  afterEach(() => {
    mockScenario = 'yaml';
  });

  /** Notifications -> Rules (now always reachable, even with Auto-sync checked). */
  async function advanceToRules(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
  }

  it('still shows the Rules step when Auto-sync is checked, and lets it be skipped', async () => {
    const { user } = render(<ImportWizardGate />);

    await advanceToRules(user);

    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
    await screen.findByText(/review import/i);
    expect(screen.getByText(/will sync continuously/i)).toBeInTheDocument();
    // Both cards are in a static, non-interactive state here (auto-sync badge, Skipped) — neither
    // should render a Preview control.
    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
  });

  it('does not enable Auto-sync when Notifications is skipped, even though Auto-sync was selected', async () => {
    const { patchSpy } = setupStatefulAutoSyncConfig(server);
    server.use(http.post('/api/convert/prometheus/config/v1/rules', () => HttpResponse.json({})));

    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });
    // Wait for the seeded Auto-sync selection to make the step valid, then Skip instead of
    // Next — the selection must be discarded, not carried through to the confirm step.
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));

    // Complete Rules so there's something to import — same shape as the bug report.
    await screen.findByRole('group', { name: /import alert rules/i });
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);

    expect(screen.queryByText(/will sync continuously/i)).not.toBeInTheDocument();
    expect(screen.getByText(/skipped/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start import/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enable auto-sync/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start import/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start import/i }));

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything())
    );
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('calls saveAutoSync (not the staging import) and tracks success when Rules is skipped', async () => {
    const { getStored } = setupStatefulAutoSyncConfig(server);
    let stagingImportCalled = false;
    server.use(
      http.post(CONVERT_URL, () => {
        stagingImportCalled = true;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { user } = render(<ImportWizardGate />);
    await advanceToRules(user);
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
    await screen.findByText(/review import/i);

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
    const { getStored } = setupStatefulAutoSyncConfig(server);
    let rulesImportCalled = false;
    server.use(
      // Confirmed via convertToGMAApi.ts: useConvertToGMAMutation (rules import) posts here,
      // a different endpoint from CONVERT_URL (notifications/dry-run only).
      http.post('/api/convert/prometheus/config/v1/rules', () => {
        rulesImportCalled = true;
        return HttpResponse.json({});
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

  it('reports a Rules-specific failure — not an Auto-sync failure — when Rules import fails after Auto-sync already succeeded', async () => {
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
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
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
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
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
