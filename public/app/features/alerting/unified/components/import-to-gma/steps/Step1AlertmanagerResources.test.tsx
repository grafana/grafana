import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React, { useCallback, useEffect } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { act, render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { mockBoundingClientRect } from '@grafana/test-utils';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from 'app/features/alerting/unified/mocks';
import {
  setupAdminConfigGet,
  setupAlertmanagersStatus,
} from 'app/features/alerting/unified/mocks/server/configure/admin_config';
import { setupDatasourcesEndpoint } from 'app/features/alerting/unified/mocks/server/configure/datasources';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { type SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { type ImportFormValues } from '../ImportToGMA';
import { useDryRunNotifications } from '../useImport';

import { Step1Content, useStep1Validation } from './Step1AlertmanagerResources';

const server = setupMswServer();

// Wrapper to provide react-hook-form context
function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<ImportFormValues>;
}) {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      step1Completed: false,
      step1Skipped: false,
      step2Completed: false,
      step2Skipped: false,
      policyTreeName: '',
      notificationsSource: 'yaml',
      notificationsDatasourceUID: undefined,
      notificationsDatasourceName: null,
      notificationsYamlFile: null,
      notificationsTemplateFiles: [],
      selectedRoutingTree: '',
      rulesSource: 'datasource',
      rulesDatasourceUID: undefined,
      rulesDatasourceName: null,
      rulesYamlFile: null,
      namespace: undefined,
      ruleGroup: undefined,
      targetFolder: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetDatasourceUID: undefined,
      ...defaultValues,
    },
  });
  return <FormProvider {...formAPI}>{children}</FormProvider>;
}

// Hook testing wrapper
function ValidationHookWrapper({ canImport, onResult }: { canImport: boolean; onResult: (result: boolean) => void }) {
  const isValid = useStep1Validation(canImport);
  useEffect(() => {
    onResult(isValid);
  }, [isValid, onResult]);
  return null;
}

const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
  name: 'Alertmanager',
  uid: 'alertmanager-uid',
  type: 'alertmanager' as SupportedRulesSourceType,
  jsonData: {
    implementation: AlertManagerImplementation.prometheus,
    handleGrafanaManagedAlerts: true,
  },
});

const defaultStep1Props = {
  canImport: true,
  dryRunState: 'idle' as const,
  onTriggerDryRun: jest.fn(),
  onResetDryRun: jest.fn(),
};

// Wires the real dry-run hook into Step1Content the way ImportWizardContent does, so the trigger
// effect runs against the real callbacks — used to guard against a re-trigger request loop.
function DryRunLoopHarness() {
  const { runDryRun, reset } = useDryRunNotifications();
  const { getValues } = useFormContext<ImportFormValues>();
  const onTriggerDryRun = useCallback(() => {
    const values = getValues();
    runDryRun({
      source: values.notificationsSource,
      datasourceName: values.notificationsDatasourceName ?? undefined,
      yamlFile: values.notificationsYamlFile,
      templateFiles: values.notificationsTemplateFiles,
      configIdentifier: values.policyTreeName,
    });
  }, [getValues, runDryRun]);

  return <Step1Content canImport dryRunState="idle" onTriggerDryRun={onTriggerDryRun} onResetDryRun={reset} />;
}

describe('Step1AlertmanagerResources', () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    setupDataSources(alertmanagerDataSource);
    grantUserPermissions([AccessControlAction.AlertingNotificationsWrite]);
  });

  describe('Step1Content rendering', () => {
    it('should render permission warning when canImport=false', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} canImport={false} />
        </TestWrapper>
      );

      expect(screen.getByText(/you do not have permission to import notification resources/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('should render Policy Tree Name field', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /policy tree name/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeInTheDocument();
    });

    it('should render source selection (YAML/datasource)', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/import source/i)).toBeInTheDocument();

      const yamlRadio = screen.getByRole('radio', { name: /import from an alertmanager configuration yaml file/i });
      const datasourceRadio = screen.getByRole('radio', { name: /import from an alertmanager data source/i });

      expect(yamlRadio).toBeInTheDocument();
      expect(datasourceRadio).toBeInTheDocument();
      expect(yamlRadio).toBeChecked();
      expect(datasourceRadio).not.toBeChecked();
    });

    it('should render YAML file upload field when YAML source selected', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/alertmanager config yaml/i)).toBeInTheDocument();
      expect(screen.getByText(/upload yaml file/i)).toBeInTheDocument();
    });

    it('should render datasource picker when datasource source selected', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const alertmanagerDataSourceLabels = screen.getAllByText(/alertmanager data source/i);

      expect(alertmanagerDataSourceLabels.length).toBeGreaterThan(0);
      expect(screen.getByText(/select data source/i)).toBeInTheDocument();
    });

    it('should render the notification templates uploader for the YAML source', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/notification templates/i)).toBeInTheDocument();
      expect(screen.getByText(/drop template files here or click to upload/i)).toBeInTheDocument();
    });

    it('should NOT render the templates uploader for the datasource source', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.queryByText(/drop template files here or click to upload/i)).not.toBeInTheDocument();
    });

    it('should list uploaded template files and show a duplicate-name error', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      // The dropzone's file input inherits the Field id, so its label resolves to it
      const input = screen.getByLabelText(/notification templates/i);

      await user.upload(input, [
        new File(['a'], 'dupe.tmpl', { type: 'text/plain' }),
        new File(['b'], 'dupe.tmpl', { type: 'text/plain' }),
      ]);

      expect(await screen.findByText(/duplicate template file name: "dupe.tmpl"/i)).toBeInTheDocument();
    });

    it('displays template files already present in form state (persists across navigation)', () => {
      render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            notificationsTemplateFiles: [
              new File(['a'], 'email.tmpl', { type: 'text/plain' }),
              new File(['b'], 'slack.tmpl', { type: 'text/plain' }),
            ],
          }}
        >
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText('email.tmpl')).toBeInTheDocument();
      expect(screen.getByText('slack.tmpl')).toBeInTheDocument();
    });

    it('removes a template file when its remove button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            notificationsTemplateFiles: [
              new File(['a'], 'email.tmpl', { type: 'text/plain' }),
              new File(['b'], 'slack.tmpl', { type: 'text/plain' }),
            ],
          }}
        >
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /remove email\.tmpl/i }));

      expect(screen.queryByText('email.tmpl')).not.toBeInTheDocument();
      expect(screen.getByText('slack.tmpl')).toBeInTheDocument();
    });
  });

  describe('useStep1Validation hook', () => {
    it('should return false when canImport=false', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper>
          <ValidationHookWrapper canImport={false} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when policyTreeName is empty', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper defaultValues={{ policyTreeName: '', notificationsSource: 'yaml' }}>
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when YAML source selected but no file', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'yaml',
            notificationsYamlFile: null,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when datasource source selected but no UID', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'datasource',
            notificationsDatasourceUID: undefined,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when policyTreeName is set but invalid', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'Invalid Name!',
            notificationsSource: 'yaml',
            notificationsYamlFile: mockFile,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return true when all required fields are filled (YAML source)', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'yaml',
            notificationsYamlFile: mockFile,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (datasource source)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'datasource',
            notificationsDatasourceUID: 'alertmanager-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  describe('dry-run trigger effect', () => {
    it('triggers the dry-run once for a stable valid config and does not loop', async () => {
      let dryRunCount = 0;
      server.use(
        http.post('/api/convert/api/v1/alerts', () => {
          dryRunCount += 1;
          return HttpResponse.json({ status: 'success' });
        })
      );

      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'prometheus-prod',
            notificationsSource: 'yaml',
            notificationsYamlFile: new File(['route:\n  receiver: default\n'], 'am.yaml', {
              type: 'application/yaml',
            }),
          }}
        >
          <DryRunLoopHarness />
        </TestWrapper>
      );

      await waitFor(() => expect(dryRunCount).toBeGreaterThanOrEqual(1));
      const settledCount = dryRunCount;
      // A single trigger (allow 2 for a StrictMode double-mount) — not a runaway loop.
      expect(settledCount).toBeLessThanOrEqual(2);
      // Give any runaway re-trigger loop time to fire more requests, then confirm it stopped.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(dryRunCount).toBe(settledCount);
    });
  });

  describe('AlertmanagerDataSourceSelect auto-population', () => {
    it('should auto-populate policyTreeName when datasource is selected and field is empty', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      // Open the datasource select and choose the alertmanager
      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Alertmanager'));

      // Verify the policy tree name field is populated with sanitized datasource name
      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('alertmanager');
    });

    it('should NOT overwrite policyTreeName when datasource is selected and field has a value', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: 'my-custom-name' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Alertmanager'));

      // Verify the policy tree name field is NOT changed
      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('my-custom-name');
    });

    it('should convert datasource name with special characters to kebab-case', async () => {
      // Setup a datasource with special characters in name
      setupDataSources(
        mockDataSource<AlertManagerDataSourceJsonData>({
          name: 'My Alertmanager (Production)',
          uid: 'am-prod-uid',
          type: 'alertmanager' as SupportedRulesSourceType,
          jsonData: {
            implementation: AlertManagerImplementation.prometheus,
            handleGrafanaManagedAlerts: true,
          },
        })
      );

      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('My Alertmanager (Production)'));

      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('my-alertmanager-production');
    });
  });

  describe('Auto-sync checkbox', () => {
    const MIMIR_DS = {
      id: 10,
      uid: 'mimir-uid',
      orgId: 1,
      name: 'Mimir Alertmanager',
      type: 'alertmanager',
      url: 'http://localhost:9009',
      jsonData: { implementation: 'mimir' },
    };
    const MIMIR_DS_2 = {
      id: 11,
      uid: 'mimir-uid-2',
      orgId: 1,
      name: 'Mimir Alertmanager 2',
      type: 'alertmanager',
      url: 'http://localhost:9010',
      jsonData: { implementation: 'mimir' },
    };

    // Mirrors MIMIR_DS/MIMIR_DS_2 in the frontend datasource list, so the same datasource is both
    // selectable in the picker and recognized as Auto-sync-capable via the backend-sourced list.
    const mimirDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
      name: MIMIR_DS.name,
      uid: MIMIR_DS.uid,
      type: 'alertmanager' as SupportedRulesSourceType,
      jsonData: { implementation: AlertManagerImplementation.mimir, handleGrafanaManagedAlerts: true },
    });
    const mimirDataSource2 = mockDataSource<AlertManagerDataSourceJsonData>({
      name: MIMIR_DS_2.name,
      uid: MIMIR_DS_2.uid,
      type: 'alertmanager' as SupportedRulesSourceType,
      jsonData: { implementation: AlertManagerImplementation.mimir, handleGrafanaManagedAlerts: true },
    });

    beforeEach(() => {
      setupAlertmanagersStatus(server);
    });

    it('is not rendered without the feature toggle, even for admins', () => {
      grantUserRole('Admin');
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.queryByRole('switch', { name: /auto-sync/i })).not.toBeInTheDocument();
    });

    describe('with the feature toggle on', () => {
      testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

      beforeEach(() => {
        setupDataSources(alertmanagerDataSource, mimirDataSource);
        // Step1Content calls useAutoSyncConfiguration() unconditionally, so every admin+toggle-on
        // render below fires these two queries regardless of what the test exercises — mock them
        // by default for the whole block rather than per test.
        setupAdminConfigGet(server, null);
        setupDatasourcesEndpoint(server, [MIMIR_DS]);
      });

      it('is not rendered for non-admins', () => {
        grantUserRole('Editor');
        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        expect(screen.queryByRole('switch', { name: /auto-sync/i })).not.toBeInTheDocument();
      });

      it('is not rendered for the YAML source', () => {
        grantUserRole('Admin');
        render(
          <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        expect(screen.queryByRole('switch', { name: /auto-sync/i })).not.toBeInTheDocument();
      });

      it('is rendered for admins on the datasource source', () => {
        grantUserRole('Admin');
        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeInTheDocument();
      });

      it('disables Policy Tree Name and skips the dry-run once checked', async () => {
        grantUserRole('Admin');
        const user = userEvent.setup();
        const onTriggerDryRun = jest.fn();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} onTriggerDryRun={onTriggerDryRun} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        onTriggerDryRun.mockClear();
        await user.click(screen.getByRole('switch', { name: /auto-sync/i }));

        expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeDisabled();
        expect(onTriggerDryRun).not.toHaveBeenCalled();
      });

      it('always lists every Alertmanager datasource regardless of auto-sync checked state', async () => {
        grantUserRole('Admin');
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        await user.click(screen.getByRole('switch', { name: /auto-sync/i }));
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();

        await user.click(screen.getByRole('combobox'));
        expect(await screen.findByText('Alertmanager')).toBeInTheDocument();
        // role="option" excludes the current-value display shown outside the menu, and the prefix
        // match tolerates the badge/URL text also picked up in the option's accessible name.
        expect(screen.getByRole('option', { name: /^Mimir Alertmanager/ })).toBeInTheDocument();
      });

      it('keeps the auto-sync switch disabled and the datasource options unbadged while the auto-sync capability query is loading, even for a Mimir datasource', async () => {
        grantUserRole('Admin');
        let resolveDatasources = (_response: unknown) => {};
        const datasourcesResponse = new Promise((resolve) => {
          resolveDatasources = resolve;
        });
        server.use(
          http.get('/api/datasources', async () => {
            await datasourcesResponse;
            return HttpResponse.json([MIMIR_DS]);
          })
        );
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeDisabled();

        await user.click(screen.getByRole('combobox'));
        const mimirOption = await screen.findByRole('option', { name: /^Mimir Alertmanager/ });
        // Scope to the option itself — "Auto-sync" is also the checkbox's own (unconditional) label.
        expect(within(mimirOption).queryByText('Auto-sync')).not.toBeInTheDocument();

        resolveDatasources(undefined);

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        const mimirOptionAfterLoad = await screen.findByRole('option', { name: /^Mimir Alertmanager/ });
        expect(within(mimirOptionAfterLoad).getByText('Auto-sync')).toBeInTheDocument();
      });

      it('does not uncheck an already-enabled Auto-sync while the capability query is still loading', async () => {
        grantUserRole('Admin');
        let resolveDatasources = (_response: unknown) => {};
        const datasourcesResponse = new Promise((resolve) => {
          resolveDatasources = resolve;
        });
        server.use(
          http.get('/api/datasources', async () => {
            await datasourcesResponse;
            return HttpResponse.json([MIMIR_DS]);
          })
        );

        render(
          <TestWrapper
            defaultValues={{
              notificationsSource: 'datasource',
              notificationsDatasourceUID: MIMIR_DS.uid,
              autoSyncNotificationsEnabled: true,
            }}
          >
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        // The reset effect must not race ahead and clear a persisted, still-valid selection just
        // because the query hasn't resolved yet.
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();

        resolveDatasources(undefined);

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();
      });

      it('disables the auto-sync switch when a non-Mimir/Cortex datasource is selected', async () => {
        grantUserRole('Admin');

        render(
          <TestWrapper
            defaultValues={{
              notificationsSource: 'datasource',
              notificationsDatasourceUID: alertmanagerDataSource.uid,
            }}
          >
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeDisabled());
      });

      it('enables the auto-sync switch when a Mimir/Cortex datasource is selected', async () => {
        grantUserRole('Admin');

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
      });

      it('unchecks and disables auto-sync when switching to a datasource that does not support it', async () => {
        grantUserRole('Admin');
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        await user.click(screen.getByRole('switch', { name: /auto-sync/i }));
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();

        await user.click(screen.getByRole('combobox'));
        await user.click(screen.getByText('Alertmanager'));

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).not.toBeChecked());
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeDisabled();
      });

      it('keeps auto-sync checked when switching between two Mimir/Cortex datasources', async () => {
        grantUserRole('Admin');
        setupDataSources(alertmanagerDataSource, mimirDataSource, mimirDataSource2);
        setupDatasourcesEndpoint(server, [MIMIR_DS, MIMIR_DS_2]);
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled());
        await user.click(screen.getByRole('switch', { name: /auto-sync/i }));
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();

        await user.click(screen.getByRole('combobox'));
        await user.click(screen.getByText('Mimir Alertmanager 2'));

        // Give any (incorrect) reset effect a chance to fire before asserting it didn't.
        await waitFor(() =>
          expect(screen.getByPlaceholderText(/prometheus-prod/i)).toHaveValue('mimir-alertmanager-2')
        );
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeChecked();
        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeEnabled();
      });

      it('labels each datasource option with its auto-sync support', async () => {
        grantUserRole('Admin');
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        await user.click(screen.getByRole('combobox'));

        const mimirOption = await screen.findByRole('option', { name: /Mimir Alertmanager/i });
        expect(within(mimirOption).getByText('Auto-sync')).toBeInTheDocument();

        const plainOption = screen.getByRole('option', { name: /^Alertmanager/i });
        expect(within(plainOption).queryByText('Auto-sync')).not.toBeInTheDocument();
      });
    });
  });
});
