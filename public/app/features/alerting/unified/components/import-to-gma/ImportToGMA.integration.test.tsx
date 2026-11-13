import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { convertResponse } from '../../mocks/convertApi';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import { setupAutoSyncConfigAbsent } from '../../mocks/server/handlers/k8s/config.k8s';
import { ALERTING_API_SERVER_BASE_URL } from '../../mocks/server/utils';
import { setupDataSources } from '../../testSetup/datasources';

import { ImportWizardGate } from './ImportToGMA';

// The real Step 1 and Step 2 inside the real wizard. ImportToGMA.test.tsx stubs both steps, so nothing
// else checks that what the steps put in the form is what the wizard validates and sends.

const CONVERT_URL = '/api/convert/api/v1/alerts';
const RULES_URL = '/api/convert/prometheus/config/v1/rules';
const DRY_RUN_HEADER = 'X-Grafana-Alerting-Dry-Run';

const server = setupMswServer();

testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

beforeAll(() => {
  mockBoundingClientRect();
});

beforeEach(() => {
  setTestFlags({ [FlagKeys.AlertingImportAlertmanagerAPI]: true });
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleExternalRead,
    AccessControlAction.AlertingProvisioningSetStatus,
    AccessControlAction.ActionAlertingNotificationsConfigRead,
  ]);
  setupDatasourcesEndpoint(server, []);
  setupAutoSyncConfigAbsent(server);
  setupDataSources(
    mockDataSource({ uid: 'prometheus-uid', name: 'Prometheus', type: 'prometheus' }, { alerting: true })
  );
  server.use(
    http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
      HttpResponse.json({ status: 'success', data: { version: '2.0.0', features: { ruler_config_api: 'true' } } })
    ),
    getCustomSearchHandler([
      { resource: 'folders', name: 'target-folder-uid', title: 'Target folder', folder: '', field: {} },
    ]),
    http.get('/api/ruler/prometheus-uid/api/v1/rules', () =>
      HttpResponse.json({ 'ns-a': [{ name: 'group-a', rules: [{ alert: 'Kept', expr: 'up == 0' }] }] })
    )
  );
  locationService.push('/');
});

afterEach(async () => {
  await act(async () => {
    setTestFlags();
  });
});

const alertmanagerYaml = () =>
  new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'am.yaml', { type: 'application/yaml' });

const rulesYaml = () =>
  new File(['groups:\n  - name: group-y\n    rules:\n      - alert: FromYaml\n        expr: up == 0\n'], 'rules.yaml', {
    type: 'application/yaml',
  });

describe('ImportToGMA wizard — real steps', () => {
  it('imports YAML notifications and data source rules, sending what the steps collected', async () => {
    const dryRunNames: Array<string | null> = [];
    let notificationsRequest: Request | undefined;
    let rulesRequest: Request | undefined;
    let rulesBody: unknown;
    server.use(
      http.post(CONVERT_URL, ({ request }) => {
        if (request.headers.get(DRY_RUN_HEADER) === 'true') {
          dryRunNames.push(request.headers.get('X-Grafana-Alerting-Config-Identifier'));
        } else {
          notificationsRequest = request.clone();
        }
        return HttpResponse.json(convertResponse());
      }),
      http.post(RULES_URL, async ({ request }) => {
        rulesRequest = request.clone();
        rulesBody = await request.json();
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    // Step 1
    await user.upload(await screen.findByLabelText(/alertmanager config yaml/i), alertmanagerYaml());
    await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'imported-tree');
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    // Step 2
    await screen.findByRole('group', { name: /import rules/i });
    const [sourcePicker] = screen.getAllByTestId(selectors.components.DataSourcePicker.inputV2);
    await waitFor(() => expect(sourcePicker).toBeEnabled());
    await user.click(sourcePicker);
    await user.click(await screen.findByRole('option', { name: /Prometheus/ }));
    // The picker opens on click, with its search box focused.
    await user.click(screen.getByRole('button', { name: /select folder/i }));
    await user.keyboard('Target');
    await user.click(await screen.findByRole('treeitem', { name: /Target folder/ }));
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    // Review and import
    await screen.findByText(/review import/i);
    await user.click(await screen.findByRole('button', { name: /start import/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start import/i }));

    await waitFor(() => expect(rulesRequest).toBeDefined());
    expect(dryRunNames).toContain('imported-tree');
    expect(notificationsRequest?.headers.get('X-Grafana-Alerting-Config-Identifier')).toBe('imported-tree');
    expect(rulesBody).toEqual({ 'ns-a': [expect.objectContaining({ name: 'group-a' })] });
    const rulesHeaders = rulesRequest!.headers;
    expect(rulesHeaders.get('X-Grafana-Alerting-Datasource-UID')).toBe('prometheus-uid');
    expect(rulesHeaders.get('X-Grafana-Alerting-Target-Datasource-UID')).toBe('prometheus-uid');
    expect(rulesHeaders.get('X-Grafana-Alerting-Folder-UID')).toBe('target-folder-uid');
    expect(JSON.parse(rulesHeaders.get('X-Grafana-Alerting-Notification-Settings') ?? '{}')).toEqual({
      policy: 'imported-tree',
    });
  });

  it('imports the rules of a YAML file to the data source chosen for it', async () => {
    let rulesRequest: Request | undefined;
    let rulesBody: unknown;
    server.use(
      http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())),
      http.post(RULES_URL, async ({ request }) => {
        rulesRequest = request.clone();
        rulesBody = await request.json();
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    // Step 1
    await user.upload(await screen.findByLabelText(/alertmanager config yaml/i), alertmanagerYaml());
    await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'imported-tree');
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    // Step 2: a YAML file runs against the data source picked for it, which also fills the recording target.
    await screen.findByRole('group', { name: /import rules/i });
    await user.click(screen.getByRole('radio', { name: /yaml file/i }));
    await user.upload(await screen.findByLabelText(/^rules yaml file/i), rulesYaml());
    const [yamlTargetPicker] = screen.getAllByTestId(selectors.components.DataSourcePicker.inputV2);
    await waitFor(() => expect(yamlTargetPicker).toBeEnabled());
    await user.click(yamlTargetPicker);
    await user.click(await screen.findByRole('option', { name: /Prometheus/ }));
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    // Review and import
    await screen.findByText(/review import/i);
    expect(screen.getByText(/will import 1 rules/i)).toBeInTheDocument();
    expect(screen.getByText('Prometheus')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /start import/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /start import/i }));

    await waitFor(() => expect(rulesRequest).toBeDefined());
    expect(rulesRequest!.headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('prometheus-uid');
    expect(rulesRequest!.headers.get('X-Grafana-Alerting-Target-Datasource-UID')).toBe('prometheus-uid');
    expect(Object.values(rulesBody as object)).toEqual([[expect.objectContaining({ name: 'group-y' })]]);
  });

  it('stays on step 1 without its own dry run when Next is clicked right after typing a taken name', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees/:name`, async ({ params }) => {
        // Slower than the click, so the name check is still running when Next is pressed.
        await delay(300);
        return params.name === 'taken'
          ? HttpResponse.json({ metadata: { name: 'taken' }, spec: { defaults: {}, routes: [] } })
          : HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      })
    );
    let dryRuns = 0;
    server.use(
      http.post(CONVERT_URL, () => {
        dryRuns += 1;
        return HttpResponse.json(convertResponse());
      })
    );
    const { user } = render(<ImportWizardGate />);

    await user.upload(await screen.findByLabelText(/alertmanager config yaml/i), alertmanagerYaml());
    // Let the debounced preview run first, so any further dry run can only come from Next.
    await waitFor(() => expect(dryRuns).toBe(1), { timeout: 3000 });
    await user.type(screen.getByPlaceholderText(/prometheus-prod/i), 'taken');
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));

    expect(await screen.findByText(/a policy tree with this name already exists/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /import rules/i })).not.toBeInTheDocument();
    expect(dryRuns).toBe(1);
  });
});
