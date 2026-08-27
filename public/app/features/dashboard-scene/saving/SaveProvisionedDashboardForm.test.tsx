import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { handyTestingSchema } from '@grafana/schema/apis/dashboard.grafana.app/v2/examples';
import { type DashboardMeta } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { type DashboardChangeInfo } from './shared';

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: AutoSizerProps) =>
      children({ width: 1000, height: 1000, scaledWidth: 1, scaledHeight: 1 })
);

// Monaco can't boot web workers in jsdom
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <textarea data-testid="code-editor" readOnly value={value} />,
}));

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  ...jest.requireActual('app/features/dashboard/api/dashboard_api'),
  getDashboardAPI: jest.fn().mockResolvedValue({
    getDashboardDTO: jest.fn().mockResolvedValue({
      apiVersion: 'dashboard.grafana.app/v2beta1',
      kind: 'Dashboard',
      metadata: { name: 'my-uid' },
      spec: {},
    }),
  }),
}));

let cleanUp = () => {};

afterEach(() => {
  cleanUp();
  cleanUp = () => {};
});

describe('SaveProvisionedDashboardForm', () => {
  describe('Classic model', () => {
    it('converts a v2 save model to v1 so the JSON can go back into file provisioning', async () => {
      await renderForm({ changedSaveModel: handyTestingSchema });

      await userEvent.click(await screen.findByText('Advanced options'));
      await userEvent.click(await screen.findByRole('radio', { name: 'Classic' }));

      const json = readEditorJson();

      expect(json.schemaVersion).toBeDefined();
      expect(Array.isArray(json.panels)).toBe(true);
      expect(json.panels.length).toBeGreaterThan(0);
      expect(json.uid).toBe('my-uid');
      expect(Array.isArray(json.templating.list)).toBe(true);

      expect(json.elements).toBeUndefined();
      expect(json.layout).toBeUndefined();
      expect(json.timeSettings).toBeUndefined();
      expect(json.cursorSync).toBeUndefined();
    });

    it('converts to v1 when the dashboard has no k8s metadata and the model picker is hidden', async () => {
      await renderForm({ changedSaveModel: handyTestingSchema, meta: { provisioned: true } });

      expect(screen.queryByRole('radio', { name: 'Classic' })).not.toBeInTheDocument();

      const json = readEditorJson();

      expect(json.schemaVersion).toBeDefined();
      expect(Array.isArray(json.panels)).toBe(true);
      expect(json.uid).toBe('my-uid');
      expect(json.elements).toBeUndefined();
    });

    it('leaves a v1 save model untouched', async () => {
      const v1Model: Dashboard = {
        title: 'a v1 dashboard',
        uid: 'my-uid',
        schemaVersion: 41,
        panels: [{ id: 1, type: 'timeseries', title: 'panel' }],
        editable: true,
      };

      await renderForm({ changedSaveModel: v1Model, meta: { provisioned: true } });

      expect(readEditorJson()).toEqual(v1Model);
    });
  });
});

function readEditorJson() {
  const editor = screen.getByTestId<HTMLTextAreaElement>('code-editor');
  return JSON.parse(editor.value);
}

async function renderForm({
  changedSaveModel,
  meta,
}: {
  changedSaveModel: Dashboard | DashboardV2Spec;
  meta?: DashboardMeta;
}) {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 41,
      panels: [],
      version: 10,
    },
    meta: meta ?? {
      provisioned: true,
      provisionedExternalId: 'dashboard.json',
      k8s: { name: 'my-uid', generation: 10, resourceVersion: '1', creationTimestamp: '2026-01-01T00:00:00Z' },
    },
  });

  dashboard.setState({ $data: undefined });
  cleanUp();
  cleanUp = dashboard.activate();
  dashboard.onEnterEditMode();
  dashboard.openSaveDrawer({});

  const drawer = dashboard.state.overlay as SaveDashboardDrawer;

  const changeInfo: DashboardChangeInfo = {
    changedSaveModel,
    initialSaveModel: changedSaveModel,
    diffs: {},
    diffCount: 0,
    hasChanges: true,
    hasTimeChanges: false,
    hasVariableValueChanges: false,
    hasRefreshChange: false,
  };

  render(
    <TestProvider>
      <SaveProvisionedDashboardForm dashboard={dashboard} drawer={drawer} changeInfo={changeInfo} />
    </TestProvider>
  );

  // the V2 resource fetch runs on mount even when Classic is selected
  await act(async () => {});
}
