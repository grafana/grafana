import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';

import { SceneObjectRef } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { DashboardChangeInfo } from './shared';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: { children: (size: { height: number; width: number }) => React.ReactNode }) =>
    children({ height: 600, width: 800 });
});

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <pre data-testid="code-editor">{value}</pre>,
}));

function buildChangeInfo(overrides: Partial<DashboardChangeInfo> = {}): DashboardChangeInfo {
  return {
    changedSaveModel: { title: 'My provisioned dashboard' },
    initialSaveModel: {},
    diffs: {},
    diffCount: 0,
    hasChanges: false,
    hasTimeChanges: false,
    hasVariableValueChanges: false,
    hasRefreshChange: false,
    ...overrides,
  } as DashboardChangeInfo;
}

interface RenderOptions {
  changeInfo?: Partial<DashboardChangeInfo>;
  provisionedExternalId?: string;
}

function renderProvisionedForm({
  changeInfo: changeInfoOverrides = {},
  provisionedExternalId = '/etc/grafana/provisioning/dashboards/my-dashboard.json',
}: RenderOptions = {}) {
  const dashboard = new DashboardScene({
    meta: { provisionedExternalId },
  });
  dashboard.activate();

  const drawer = new SaveDashboardDrawer({
    dashboardRef: new SceneObjectRef(dashboard),
  });
  drawer.activate();

  const changeInfo = buildChangeInfo(changeInfoOverrides);

  const renderResult = render(
    <SaveProvisionedDashboardForm dashboard={dashboard} drawer={drawer} changeInfo={changeInfo} />
  );

  return {
    ...renderResult,
    dashboard,
    drawer,
    user: userEvent.setup(),
    elements: {
      cancelButton: () => renderResult.getByRole('button', { name: 'Cancel' }),
      copyJsonButton: () => renderResult.getByRole('button', { name: 'Copy JSON to clipboard' }),
      saveJsonButton: () => renderResult.getByRole('button', { name: 'Save JSON to file' }),
    },
  };
}

describe('<SaveProvisionedDashboardForm />', () => {
  test('renders the provisioning explanation text', () => {
    const { getByText } = renderProvisionedForm();

    expect(
      getByText(/This dashboard cannot be saved from the Grafana UI because it has been provisioned/)
    ).toBeInTheDocument();
  });

  test('renders the file path from dashboard meta', () => {
    const { getByText } = renderProvisionedForm({
      provisionedExternalId: '/etc/grafana/dashboards/custom.json',
    });

    expect(getByText(/\/etc\/grafana\/dashboards\/custom\.json/)).toBeInTheDocument();
  });

  test('renders the JSON code editor with the serialized dashboard model', () => {
    const changedSaveModel: Dashboard = { title: 'My provisioned dashboard', uid: 'abc', schemaVersion: 42 };

    const { getByTestId } = renderProvisionedForm({ changeInfo: { changedSaveModel } });

    expect(getByTestId('code-editor').textContent).toBe(JSON.stringify(changedSaveModel, null, 2));
  });

  test('renders Cancel, "Copy JSON to clipboard", and "Save JSON to file" buttons', () => {
    const { elements } = renderProvisionedForm();

    expect(elements.cancelButton()).toBeInTheDocument();
    expect(elements.copyJsonButton()).toBeInTheDocument();
    expect(elements.saveJsonButton()).toBeInTheDocument();
  });

  test('when user clicks Cancel, calls drawer.onClose()', async () => {
    const { elements, user, dashboard } = renderProvisionedForm();
    dashboard.setInitialSaveModel({ title: '', schemaVersion: 42, panels: [] });
    dashboard.setState({ overlay: {} as SaveDashboardDrawer });

    await user.click(elements.cancelButton());

    expect(dashboard.state.overlay).toBeUndefined();
  });

  test('when user clicks "Save JSON to file", calls saveAs with a Blob containing the dashboard JSON', async () => {
    const changedSaveModel: Dashboard = { title: 'My provisioned dashboard', schemaVersion: 42 };

    const { elements, user } = renderProvisionedForm({ changeInfo: { changedSaveModel } });

    await user.click(elements.saveJsonButton());

    const saveAsMock = jest.mocked(saveAs);
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [data, filename] = saveAsMock.mock.calls[0];
    expect(data).toBeInstanceOf(Blob);
    expect(filename).toMatch(/^My provisioned dashboard-\d+\.json$/);

    const blob = data as Blob;
    expect(blob.type).toBe('application/json;charset=utf-8');
    expect(await blob.text()).toBe(JSON.stringify(changedSaveModel, null, 2));
  });
});
