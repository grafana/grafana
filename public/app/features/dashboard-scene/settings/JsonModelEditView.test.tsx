import { cleanup, render, screen } from 'test/test-utils';

import { type FetchError } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { defaultSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type MetaStatus } from 'app/features/apiserver/types';

import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';

import { JsonModelEditView } from './JsonModelEditView';

const saveDashboardMutationMock = jest.fn();

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

// Monaco's web workers are unavailable in jsdom.
jest.mock('../v2schema/DashboardSchemaEditor', () => ({
  DashboardSchemaEditor: () => null,
}));

describe('JsonModelEditView.getEditedSaveModel', () => {
  it('unwraps the v2 resource envelope back to the bare spec', () => {
    const view = new JsonModelEditView({});
    // A v2 spec is detected by the presence of `elements`.
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ elements: {}, title: 'current' } as unknown as ReturnType<typeof view.getSaveModel>);

    const resource = {
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      metadata: { name: 'abc-123' },
      spec: { elements: {}, title: 'edited' },
    };
    view.setState({ jsonText: JSON.stringify(resource) });

    expect(view.getEditedSaveModel()).toEqual(resource.spec);
  });

  it('returns the parsed model as-is for v1 dashboards', () => {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ title: 'v1 dashboard' } as unknown as ReturnType<typeof view.getSaveModel>);

    const model = { title: 'v1 dashboard', panels: [] };
    view.setState({ jsonText: JSON.stringify(model) });

    expect(view.getEditedSaveModel()).toEqual(model);
  });
});

describe('JsonModelEditView.validateEditedResource', () => {
  function setupV2View() {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ elements: {}, title: 'current' } as unknown as ReturnType<typeof view.getSaveModel>);
    jest
      .spyOn(view, 'getDashboard')
      .mockReturnValue({ state: { uid: 'abc-123' } } as unknown as ReturnType<typeof view.getDashboard>);
    return view;
  }

  it('accepts spec-only edits to a v2 resource envelope', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({
        kind: 'Dashboard',
        metadata: { name: 'abc-123' },
        spec: { elements: {}, title: 'edited' },
      }),
    });

    expect(view.validateEditedResource()).toEqual({ success: true });
  });

  it('rejects changes to the resource kind', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({ kind: 'NotADashboard', metadata: { name: 'abc-123' }, spec: { elements: {} } }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects changes to metadata.name (identifier)', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({ kind: 'Dashboard', metadata: { name: 'changed' }, spec: { elements: {} } }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects unsupported metadata edits (e.g. labels)', () => {
    const view = setupV2View();
    view.setState({
      jsonText: JSON.stringify({
        kind: 'Dashboard',
        metadata: { name: 'abc-123', labels: { foo: 'bar' } },
        spec: { elements: {} },
      }),
    });

    const result = view.validateEditedResource();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('skips envelope validation for v1 dashboards', () => {
    const view = new JsonModelEditView({});
    jest
      .spyOn(view, 'getSaveModel')
      .mockReturnValue({ title: 'v1 dashboard' } as unknown as ReturnType<typeof view.getSaveModel>);
    view.setState({ jsonText: JSON.stringify({ title: 'v1 dashboard', panels: [] }) });

    expect(view.validateEditedResource()).toEqual({ success: true });
  });
});

describe('JsonModelEditView save failures', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaDashboardSettingsRedesign]: false });
    saveDashboardMutationMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it.each([
    {
      reason: 'Invalid',
      status: 422,
      message: 'Dashboard is invalid',
      details: { causes: [{ field: 'spec.title', message: 'title cannot be empty' }] },
      expectedTitle: 'This dashboard is not valid',
      expectedMessage: 'spec.title: title cannot be empty',
    },
    {
      reason: 'Forbidden',
      status: 403,
      message: 'Permission to update this dashboard was revoked',
      expectedTitle: 'You do not have permission to save this dashboard',
      expectedMessage: 'Permission to update this dashboard was revoked',
    },
    {
      reason: 'InternalError',
      status: 500,
      message: 'Failed to write to storage',
      expectedTitle: 'Failed to save dashboard',
      expectedMessage: 'Failed to write to storage',
    },
  ])(
    'displays the server explanation for $reason',
    async ({ status, reason, message, details, expectedTitle, expectedMessage }) => {
      const error: FetchError<MetaStatus> = {
        status,
        config: { url: '/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/my-uid' },
        data: { kind: 'Status', status: 'Failure', message, reason, details, code: status },
      };
      saveDashboardMutationMock.mockResolvedValue({ error });
      const dashboard = transformSaveModelSchemaV2ToScene({
        apiVersion: 'dashboard.grafana.app/v2',
        kind: 'DashboardWithAccessInfo',
        metadata: { name: 'my-uid', resourceVersion: '1', creationTimestamp: '2026-01-01T00:00:00Z' },
        spec: { ...defaultSpec(), title: 'Dashboard' },
        access: { canSave: true },
      });
      const view = new JsonModelEditView({});
      dashboard.setState({ editview: view });
      view.setState({ jsonText: view.getJsonText() });
      const { user } = render(<view.Component model={view} />);

      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText(expectedTitle)).toBeInTheDocument();
      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(saveDashboardMutationMock).toHaveBeenCalledWith(expect.objectContaining({ showErrorAlert: false }));
    }
  );
});
