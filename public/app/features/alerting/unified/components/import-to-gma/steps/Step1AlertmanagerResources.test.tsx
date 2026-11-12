import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isEqual } from 'lodash';
import { HttpResponse, delay, http } from 'msw';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getWrapper, render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { type AlertManagerDataSourceJsonData, AlertManagerImplementation } from '@grafana/alerting/internal';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { useAppNotification } from 'app/core/copy/appNotification';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupAlertmanagersStatus } from 'app/features/alerting/unified/mocks/server/configure/alertmanagers';
import { setupDatasourcesEndpoint } from 'app/features/alerting/unified/mocks/server/configure/datasources';
import {
  setupAutoSyncConfig,
  setupAutoSyncConfigAbsent,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/config.k8s';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { type SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';

import { buildDryRunArgs } from '../ImportToGMA';
import { type ImportFormValues } from '../types';

import {
  Step1Content,
  useAutoSyncPrediction,
  usePredictedAutoSyncIdentifier,
  useStep1Validation,
} from './Step1AlertmanagerResources';

const server = setupMswServer();

// Toasts are reported through app notifications, so that is where drop-confirmation text has to be
// asserted — it never reaches the DOM from here.
jest.mock('app/core/copy/appNotification');
const notifySuccess = jest.fn();

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

// A Mimir Alertmanager shares its configuration, so the picker lets it be selected. A plain Prometheus
// one (alertmanagerDataSource above) is listed but disabled.
const selectableAlertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
  name: 'Alertmanager',
  uid: 'alertmanager-uid',
  type: 'alertmanager' as SupportedRulesSourceType,
  jsonData: {
    implementation: AlertManagerImplementation.mimir,
    handleGrafanaManagedAlerts: true,
  },
});

const defaultStep1Props = {
  canImport: true,
  dryRunState: 'idle' as const,
};

describe('Step1AlertmanagerResources', () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    setupDataSources(alertmanagerDataSource);
    grantUserPermissions([AccessControlAction.AlertingNotificationsWrite]);
    notifySuccess.mockClear();
    jest.mocked(useAppNotification).mockReturnValue({
      success: notifySuccess,
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
    });
  });

  describe('Step1Content rendering', () => {
    it('should render permission warning when canImport=false', async () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} canImport={false} />
        </TestWrapper>
      );

      // The YAML source mounts a lazy template dropzone even without import permission.
      expect(await screen.findByText(/drop template files here or click to upload/i)).toBeInTheDocument();

      expect(screen.getByText(/you do not have permission to import notification configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('renders the YAML source fields and accepts a configuration upload with a removable row and success toast', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /policy tree name/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeInTheDocument();
      expect(screen.getByText(/import source/i)).toBeInTheDocument();

      const yamlRadio = screen.getByRole('radio', { name: /import from an alertmanager configuration yaml file/i });
      const datasourceRadio = screen.getByRole('radio', { name: /import from an alertmanager data source/i });

      expect(yamlRadio).toBeInTheDocument();
      expect(datasourceRadio).toBeInTheDocument();
      expect(yamlRadio).toBeChecked();
      expect(datasourceRadio).not.toBeChecked();
      expect(screen.getByText(/alertmanager config yaml/i)).toBeInTheDocument();
      // FileDropzone's own hidden <small> caption carries the same text, so target the visible one.
      expect(screen.getByText(/accepted file types: \.yaml, \.yml/i, { selector: ':not(small)' })).toBeInTheDocument();
      // FileDropzone is lazy-loaded (React.lazy/Suspense) — wait for it to mount.
      expect(await screen.findByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
      expect(screen.getByText(/notification templates/i)).toBeInTheDocument();
      expect(await screen.findByText(/drop template files here or click to upload/i)).toBeInTheDocument();

      const input = await screen.findByLabelText(/alertmanager config yaml/i);
      await user.upload(input, new File(['route:\n  receiver: default\n'], 'am.yaml', { type: 'application/yaml' }));

      expect(await screen.findByText('am.yaml')).toBeInTheDocument();
      // Only one config file can be imported, so the drop zone makes way for it.
      expect(screen.queryByText(/drop yaml file here or click to upload/i)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /remove am\.yaml/i }));

      expect(screen.queryByText('am.yaml')).not.toBeInTheDocument();
      expect(screen.getByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
      expect(notifySuccess).toHaveBeenCalledWith('Configuration file uploaded', 'am.yaml');
    });

    it('rejects a file with a non-YAML extension', async () => {
      // Real drag-and-drop bypasses the OS dialog's accept filter that userEvent.upload mimics by default.
      const user = userEvent.setup({ applyAccept: false });
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const input = await screen.findByLabelText(/alertmanager config yaml/i);
      await user.upload(input, new File(['{}'], 'config.json', { type: 'application/json' }));

      expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
      expect(screen.queryByText('config.json')).not.toBeInTheDocument();
      expect(screen.getByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
      expect(notifySuccess).not.toHaveBeenCalled();
    });

    it('rejects a .txt file even though its MIME type collides with the accepted .yml bucket', async () => {
      // Real drag-and-drop bypasses the OS dialog's accept filter that userEvent.upload mimics by default.
      const user = userEvent.setup({ applyAccept: false });
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const input = await screen.findByLabelText(/alertmanager config yaml/i);
      await user.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }));

      expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
      expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
      expect(screen.getByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
      expect(notifySuccess).not.toHaveBeenCalled();
    });

    it('removes the YAML file when its remove button is clicked', async () => {
      const { user } = render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            notificationsYamlFile: new File(['route:\n  receiver: default\n'], 'am.yaml', {
              type: 'application/yaml',
            }),
          }}
        >
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText('am.yaml')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /remove am\.yaml/i }));

      expect(screen.queryByText('am.yaml')).not.toBeInTheDocument();
    });

    it('renders the datasource picker without the templates uploader for the datasource source', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const alertmanagerDataSourceLabels = screen.getAllByText(/alertmanager data source/i);

      expect(alertmanagerDataSourceLabels.length).toBeGreaterThan(0);
      expect(screen.getByText(/select data source/i)).toBeInTheDocument();
      expect(screen.queryByText(/drop template files here or click to upload/i)).not.toBeInTheDocument();
    });

    it('shows a success toast when a single template file is dropped', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const input = await screen.findByLabelText(/notification templates/i);
      await user.upload(input, new File(['a'], 'email.tmpl', { type: 'text/plain' }));

      expect(await screen.findByText('email.tmpl')).toBeInTheDocument();
      expect(notifySuccess).toHaveBeenCalledWith('Template file added', 'email.tmpl');
    });

    it('shows a single pluralized toast when multiple template files are dropped in one gesture', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const input = await screen.findByLabelText(/notification templates/i);
      await user.upload(input, [
        new File(['a'], 'email.tmpl', { type: 'text/plain' }),
        new File(['b'], 'slack.tmpl', { type: 'text/plain' }),
      ]);

      expect(await screen.findByText('email.tmpl')).toBeInTheDocument();
      expect(notifySuccess).toHaveBeenCalledTimes(1);
      expect(notifySuccess).toHaveBeenCalledWith('Template files added', 'email.tmpl, slack.tmpl');
    });

    it('shows the toast for a template drop even while the dry-run banner reports an error for the config', async () => {
      const { user } = render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            policyTreeName: 'prometheus-prod',
            notificationsYamlFile: new File(['not valid yaml'], 'am.yaml', { type: 'application/yaml' }),
          }}
        >
          <Step1Content
            {...defaultStep1Props}
            dryRunState="error"
            dryRunResult={{ valid: false, error: 'invalid config', renamedReceivers: [], renamedTimeIntervals: [] }}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/validation failed/i)).toBeInTheDocument();

      const input = await screen.findByLabelText(/notification templates/i);
      await user.upload(input, new File(['a'], 'email.tmpl', { type: 'text/plain' }));

      expect(await screen.findByText('email.tmpl')).toBeInTheDocument();
      // The dry-run error banner is unrelated to (and unaffected by) the template drop.
      expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      expect(notifySuccess).toHaveBeenCalledWith('Template file added', 'email.tmpl');
    });

    it('should list uploaded template files and show a duplicate-name error', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      // The dropzone's file input inherits the Field id, so its label resolves to it
      const input = await screen.findByLabelText(/notification templates/i);

      await user.upload(input, [
        new File(['a'], 'dupe.tmpl', { type: 'text/plain' }),
        new File(['b'], 'dupe.tmpl', { type: 'text/plain' }),
      ]);

      expect(await screen.findByText(/duplicate template file name: "dupe.tmpl"/i)).toBeInTheDocument();
    });

    it('displays template files already present in form state and removes only the chosen file', async () => {
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

      expect(screen.getByText('email.tmpl')).toBeInTheDocument();
      expect(screen.getByText('slack.tmpl')).toBeInTheDocument();

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

    // isStep1Valid recomputes from the live value every render, so it needs no debounce fix.
    it('reflects the current, still-valid name immediately without blur', async () => {
      const user = userEvent.setup();
      // ValidationHookWrapper above only re-notifies on change, which never happens here (isValid is
      // true throughout) — render the live value directly instead.
      function ValidationDisplay({ canImport }: { canImport: boolean }) {
        const isValid = useStep1Validation(canImport);
        return <div data-testid="step1-valid">{String(isValid)}</div>;
      }

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
          <Step1Content {...defaultStep1Props} />
          <ValidationDisplay canImport />
        </TestWrapper>
      );

      await waitFor(() => expect(screen.getByTestId('step1-valid')).toHaveTextContent('true'));

      const input = screen.getByPlaceholderText(/prometheus-prod/i);
      // Single keystroke — see the comment on the equivalent edit above.
      await user.type(input, '2');
      expect(input).toHaveFocus(); // no blur happened
      expect(input).toHaveValue('prometheus-prod2');

      // No waitFor: this must already be true on the very next render, with no async settling.
      expect(screen.getByTestId('step1-valid')).toHaveTextContent('true');
    });

    it('shows the check result in the import source card, before a policy tree name is entered', () => {
      render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            policyTreeName: '',
            notificationsYamlFile: new File(['route:\n  receiver: default\n'], 'am.yaml', { type: 'application/yaml' }),
          }}
        >
          <Step1Content
            {...defaultStep1Props}
            dryRunState="error"
            dryRunResult={{
              valid: false,
              error: 'Imported contact point [oncall] is invalid',
              renamedReceivers: [],
              renamedTimeIntervals: [],
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/imported contact point \[oncall\] is invalid/i)).toBeInTheDocument();
    });
  });

  describe('policy tree name check', () => {
    it('flags a name a policy tree already uses', async () => {
      server.use(
        http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`, ({ params }) =>
          params.name === 'prometheus-prod'
            ? HttpResponse.json({ metadata: { name: 'prometheus-prod' }, spec: { defaults: {}, routes: [] } })
            : HttpResponse.json({ message: 'NotFound' }, { status: 404 })
        )
      );
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'prometheus-prod');
      await user.tab();

      expect(await screen.findByText(/a policy tree with this name already exists/i)).toBeInTheDocument();
    });

    it('rejects the name reserved for the default policy', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'default');
      await user.tab();

      expect(await screen.findByText(/reserved for the default policy/i)).toBeInTheDocument();
    });

    it('accepts a name no policy tree uses', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'brand-new-tree');
      await user.tab();

      await waitFor(() =>
        expect(screen.getByPlaceholderText(/prometheus-prod/i)).not.toHaveAttribute('aria-invalid', 'true')
      );
      expect(screen.queryByText(/a policy tree with this name already exists/i)).not.toBeInTheDocument();
    });
  });

  describe('AlertmanagerDataSourceSelect', () => {
    // It only shares its configuration with every credential replaced by "<secret>".
    it('disables a plain Prometheus Alertmanager and suggests uploading its YAML file instead', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('combobox'));
      expect(
        screen.getByText(/doesn't share its full configuration\. upload its yaml file instead/i)
      ).toBeInTheDocument();

      await user.click(screen.getByText('Alertmanager'));

      // Nothing was picked, so the name isn't filled in from it.
      expect(screen.getByPlaceholderText(/prometheus-prod/i)).toHaveValue('');
    });
  });

  describe('AlertmanagerDataSourceSelect auto-population', () => {
    it('should auto-populate policyTreeName when datasource is selected and field is empty', async () => {
      setupDataSources(selectableAlertmanagerDataSource);
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
      setupDataSources(selectableAlertmanagerDataSource);
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
            implementation: AlertManagerImplementation.mimir,
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
        // useAutoSyncConfiguration gates its Config and datasources queries on
        // ActionAlertingNotificationsConfigRead, which grantUserRole('Admin') alone doesn't imply
        // here since roles and permissions are mocked independently. Also repeats the outer
        // beforeEach's Write grant, since grantUserPermissions replaces rather than extends it.
        grantUserPermissions([
          AccessControlAction.AlertingNotificationsWrite,
          AccessControlAction.ActionAlertingNotificationsConfigRead,
        ]);
        // Step1Content calls useAutoSyncConfiguration() unconditionally, so every admin+toggle-on
        // render below fires these two queries regardless of what the test exercises — mock them
        // by default for the whole block rather than per test.
        setupAutoSyncConfig(server);
        setupDatasourcesEndpoint(server, [MIMIR_DS]);
      });

      describe('the name auto-sync will use', () => {
        function predictName(autoSyncActive = true, datasourceName: string = MIMIR_DS.name) {
          const seen: Array<ReturnType<typeof useAutoSyncPrediction>> = [];
          const view = renderHook(
            () => {
              const prediction = useAutoSyncPrediction(autoSyncActive, MIMIR_DS.uid, datasourceName);
              seen.push(prediction);
              return prediction;
            },
            { wrapper: getWrapper({}) }
          );
          return { ...view, seen };
        }

        function serveRoutingTrees(names: string[], responseDelay = 0) {
          server.use(
            http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, async () => {
              await delay(responseDelay);
              return HttpResponse.json({
                kind: 'RoutingTree',
                metadata: {},
                items: names.map((name) => ({
                  metadata: { name },
                  spec: { defaults: { receiver: 'x' }, routes: [] },
                })),
              });
            })
          );
        }

        function serveStagedImport(identifier: string, responseDelay = 0) {
          server.use(
            http.get('/api/alertmanager/:name/config/api/v1/alerts', async () => {
              await delay(responseDelay);
              return HttpResponse.json({
                alertmanager_config: {},
                template_files: {},
                extra_config: [{ identifier, merge_matchers: [], alertmanager_config: '', template_files: {} }],
              });
            })
          );
        }

        beforeEach(() => {
          grantUserRole('Admin');
        });

        it('names the policy tree after the datasource', async () => {
          const { result } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: 'mimir-alertmanager' }));
        });

        it('reports a conflict when a policy tree uses the name', async () => {
          serveRoutingTrees(['mimir-alertmanager', 'mimir-alertmanager-2']);
          const { result } = predictName();

          await waitFor(() =>
            expect(result.current).toEqual({ identifier: 'mimir-alertmanager', conflict: 'policy-tree' })
          );
        });

        it('reports a conflict for a name reserved for the default policy', async () => {
          const { result } = predictName(true, 'User Defined');

          await waitFor(() => expect(result.current).toEqual({ identifier: 'user-defined', conflict: 'reserved' }));
        });

        it('keeps the UID when a policy tree from an earlier sync has it', async () => {
          serveRoutingTrees([MIMIR_DS.uid, 'mimir-alertmanager']);
          const { result } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: MIMIR_DS.uid }));
        });

        it('keeps the UID when a staged import from an earlier sync has it', async () => {
          serveStagedImport(MIMIR_DS.uid);
          serveRoutingTrees(['mimir-alertmanager']);
          const { result } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: MIMIR_DS.uid }));
        });

        it('does not count a staged import under the datasource name as taken', async () => {
          serveStagedImport('mimir-alertmanager');
          const { result } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: 'mimir-alertmanager' }));
        });

        // Each source is delayed on its own while the others answer at once. A prediction made before the
        // slow one answers would be built from partial data, so every prediction seen must be the final one.
        function expectOnlyFinalPrediction(seen: Array<ReturnType<typeof useAutoSyncPrediction>>, final: object) {
          expect(seen.filter(Boolean).length).toBeGreaterThan(0);
          expect(seen.filter(Boolean).every((prediction) => isEqual(prediction, final))).toBe(true);
        }

        it('uses the recorded name and shows no conflict while the Config loads', async () => {
          server.use(
            http.get(
              '/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/:namespace/configs/:name',
              async () => {
                await delay(150);
                return HttpResponse.json({
                  apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
                  kind: 'Config',
                  metadata: { name: 'default', namespace: 'default' },
                  spec: {},
                  status: { externalAlertmanagerSync: { datasourceUid: MIMIR_DS.uid, identifier: 'recorded-name' } },
                });
              }
            )
          );
          serveRoutingTrees(['mimir-alertmanager']);
          const { result, seen } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: 'recorded-name' }));
          expectOnlyFinalPrediction(seen, { identifier: 'recorded-name' });
        });

        it('has no prediction while the policy trees load', async () => {
          serveRoutingTrees(['mimir-alertmanager'], 150);
          const { result, seen } = predictName();

          await waitFor(() =>
            expect(result.current).toEqual({ identifier: 'mimir-alertmanager', conflict: 'policy-tree' })
          );
          expectOnlyFinalPrediction(seen, { identifier: 'mimir-alertmanager', conflict: 'policy-tree' });
        });

        it('has no prediction while the staged import loads', async () => {
          serveStagedImport(MIMIR_DS.uid, 150);
          serveRoutingTrees(['mimir-alertmanager']);
          const { result, seen } = predictName();

          await waitFor(() => expect(result.current).toEqual({ identifier: MIMIR_DS.uid }));
          expectOnlyFinalPrediction(seen, { identifier: MIMIR_DS.uid });
        });

        it('shows the conflict once the staged import has loaded', async () => {
          serveStagedImport('another-import', 150);
          serveRoutingTrees(['mimir-alertmanager']);
          const { result, seen } = predictName();

          await waitFor(() =>
            expect(result.current).toEqual({ identifier: 'mimir-alertmanager', conflict: 'policy-tree' })
          );
          expectOnlyFinalPrediction(seen, { identifier: 'mimir-alertmanager', conflict: 'policy-tree' });
        });

        it('has no prediction while auto-sync is not selected', () => {
          const { result } = predictName(false);

          expect(result.current).toBeUndefined();
        });

        it.each([
          ['the slug when nothing uses it', [], 'mimir-alertmanager'],
          ['the UID when a policy tree from an earlier sync has it', [MIMIR_DS.uid], MIMIR_DS.uid],
        ])('sends %s as the dry run identifier', async (_, trees, expected) => {
          serveRoutingTrees(trees);
          const { result } = renderHook(
            () => {
              const identifier = usePredictedAutoSyncIdentifier(true, MIMIR_DS.uid, MIMIR_DS.name);
              return identifier
                ? buildDryRunArgs(
                    {
                      policyTreeName: '',
                      notificationsSource: 'datasource',
                      notificationsDatasourceUID: MIMIR_DS.uid,
                      notificationsDatasourceName: MIMIR_DS.name,
                      notificationsYamlFile: null,
                      notificationsTemplateFiles: [],
                      autoSyncNotificationsEnabled: true,
                    },
                    identifier
                  )
                : undefined;
            },
            { wrapper: getWrapper({}) }
          );

          await waitFor(() => expect(result.current).toMatchObject({ configIdentifier: expected }));
        });
      });

      describe('when the name the sync would use is taken', () => {
        function setupStep1(autoSyncNotificationsEnabled: boolean, onResult = jest.fn()) {
          render(
            <TestWrapper
              defaultValues={{
                notificationsSource: 'datasource',
                notificationsDatasourceUID: MIMIR_DS.uid,
                notificationsDatasourceName: MIMIR_DS.name,
                autoSyncNotificationsEnabled,
                policyTreeName: autoSyncNotificationsEnabled ? '' : 'my-own-tree',
              }}
            >
              <Step1Content {...defaultStep1Props} />
              <ValidationHookWrapper canImport={true} onResult={onResult} />
            </TestWrapper>
          );
          return onResult;
        }

        beforeEach(() => {
          grantUserRole('Admin');
          server.use(
            http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, () =>
              HttpResponse.json({
                kind: 'RoutingTree',
                metadata: {},
                items: [
                  { metadata: { name: 'mimir-alertmanager' }, spec: { defaults: { receiver: 'x' }, routes: [] } },
                ],
              })
            )
          );
        });

        it('shows the conflict and blocks Next when auto-sync is selected', async () => {
          const onResult = setupStep1(true);

          expect(
            await screen.findByText(/would use the name mimir-alertmanager, which a policy tree already uses/i)
          ).toBeInTheDocument();
          expect(screen.getByText(/rename the data source or the policy tree/i)).toBeInTheDocument();
          await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
        });

        it('shows nothing and does not block when auto-sync is off', async () => {
          const onResult = setupStep1(false);

          await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
          expect(screen.queryByText(/would use the name/i)).not.toBeInTheDocument();
        });
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

      it('enables auto-sync for Mimir and, once checked, disables Policy Tree Name without filtering datasources', async () => {
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
        expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeDisabled();

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

      it('disables the auto-sync switch when the Config singleton has not been seeded yet', async () => {
        grantUserRole('Admin');
        setupAutoSyncConfigAbsent(server);
        const user = userEvent.setup();

        render(
          <TestWrapper defaultValues={{ notificationsSource: 'datasource', notificationsDatasourceUID: MIMIR_DS.uid }}>
            <Step1Content {...defaultStep1Props} />
          </TestWrapper>
        );

        // Wait for the (Config-independent) datasource-capability query to settle and recognize
        // MIMIR_DS as eligible, so a still-loading disable isn't mistaken for the readiness gate.
        await user.click(screen.getByRole('combobox'));
        const mimirOption = await screen.findByRole('option', { name: /^Mimir Alertmanager/ });
        expect(within(mimirOption).getByText('Auto-sync')).toBeInTheDocument();

        expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeDisabled();
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

      it('clears a checked Auto-sync when the user switches to a data source that cannot sync', async () => {
        grantUserRole('Admin');
        // Selectable in the picker, but the backend doesn't list it as able to sync (the default endpoint
        // above only returns MIMIR_DS).
        setupDataSources(alertmanagerDataSource, mimirDataSource, mimirDataSource2);
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

        await waitFor(() => expect(screen.getByRole('switch', { name: /auto-sync/i })).toBeDisabled());
        expect(screen.getByRole('switch', { name: /auto-sync/i })).not.toBeChecked();
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
