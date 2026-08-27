import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import { type Dashboard } from '@grafana/schema';
import {
  defaultGridLayoutItemKind,
  defaultPanelKind,
  defaultSpec as defaultDashboardV2Spec,
  type RowsLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

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
    it('serializes a v2 dashboard to v1 so the JSON can go back into file provisioning', async () => {
      await renderForm(buildV2Scene(v2SpecWithTwoPanels()));

      await userEvent.click(await screen.findByText('Advanced options'));
      await userEvent.click(await screen.findByRole('radio', { name: 'Classic' }));

      const json = readEditorJson();

      expect(json.schemaVersion).toBeDefined();
      expect(Array.isArray(json.panels)).toBe(true);
      expect(json.panels.length).toBeGreaterThan(0);
      expect(json.panels.map((panel: { title: string }) => panel.title)).toEqual(['First', 'Second']);
      expect(json.uid).toBe('my-uid');

      expect(json.elements).toBeUndefined();
      expect(json.layout).toBeUndefined();
      expect(json.timeSettings).toBeUndefined();
      expect(json.cursorSync).toBeUndefined();
    });

    it('warns that v2 only features are lost, but only for the classic model', async () => {
      await renderForm(buildV2Scene(v2SpecWithTwoPanels()));

      expect(screen.queryByText(/cannot be represented in the classic format/)).not.toBeInTheDocument();

      await userEvent.click(await screen.findByText('Advanced options'));
      await userEvent.click(await screen.findByRole('radio', { name: 'Classic' }));

      expect(await screen.findByText(/cannot be represented in the classic format/)).toBeInTheDocument();
    });

    it('serializes a v2 dashboard that uses rows rather than crashing the form', async () => {
      await renderForm(buildV2Scene(withRowsLayout(v2SpecWithTwoPanels())));

      await userEvent.click(await screen.findByText('Advanced options'));
      await userEvent.click(await screen.findByRole('radio', { name: 'Classic' }));

      const json = readEditorJson();

      expect(json.schemaVersion).toBeDefined();
      expect(json.panels.some((panel: { type: string }) => panel.type === 'row')).toBe(true);
      expect(json.elements).toBeUndefined();
      expect(json.layout).toBeUndefined();
    });

    it('leaves a v1 save model untouched', async () => {
      const v1Model: DashboardDataDTO = {
        title: 'a v1 dashboard',
        uid: 'my-uid',
        schemaVersion: 41,
        panels: [{ id: 1, type: 'timeseries', title: 'panel' }],
        editable: true,
      };
      const dashboard = transformSaveModelToScene({ dashboard: v1Model, meta: { provisioned: true } });

      await renderForm(dashboard, v1Model);

      expect(readEditorJson()).toEqual(v1Model);
      expect(screen.queryByText(/cannot be represented in the classic format/)).not.toBeInTheDocument();
    });
  });
});

function readEditorJson() {
  const editor = screen.getByTestId<HTMLTextAreaElement>('code-editor');
  return JSON.parse(editor.value);
}

function v2SpecWithTwoPanels(): DashboardV2Spec {
  const titles = ['First', 'Second'];

  return {
    ...defaultDashboardV2Spec(),
    title: 'a provisioned dashboard',
    elements: Object.fromEntries(
      titles.map((title, index) => [
        `panel-${index + 1}`,
        { ...defaultPanelKind(), spec: { ...defaultPanelKind().spec, id: index + 1, title } },
      ])
    ),
    layout: {
      kind: 'GridLayout',
      spec: {
        items: titles.map((_, index) => ({
          ...defaultGridLayoutItemKind(),
          spec: {
            ...defaultGridLayoutItemKind().spec,
            element: { kind: 'ElementReference', name: `panel-${index + 1}` },
            x: 0,
            y: index * 8,
            width: 12,
            height: 8,
          },
        })),
      },
    },
  };
}

/** Nests the grid layout inside a single row, so the scene uses RowsLayoutManager. */
function withRowsLayout(spec: DashboardV2Spec): DashboardV2Spec {
  const layout: RowsLayoutKind = {
    kind: 'RowsLayout',
    spec: {
      rows: [{ kind: 'RowsLayoutRow', spec: { title: 'A row', layout: spec.layout } }],
    },
  };

  return { ...spec, layout };
}

function buildV2Scene(spec: DashboardV2Spec): DashboardScene {
  return transformSaveModelSchemaV2ToScene({
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'DashboardWithAccessInfo',
    spec,
    metadata: {
      name: 'my-uid',
      generation: 10,
      resourceVersion: '1',
      creationTimestamp: '2026-01-01T00:00:00Z',
    },
    access: {},
  });
}

async function renderForm(dashboard: DashboardScene, changedSaveModel?: Dashboard | DashboardV2Spec) {
  dashboard.setState({
    $data: undefined,
    meta: { ...dashboard.state.meta, provisioned: true, provisionedExternalId: 'dashboard.json' },
  });

  cleanUp();
  cleanUp = dashboard.activate();
  dashboard.onEnterEditMode();
  dashboard.openSaveDrawer({});

  const drawer = dashboard.state.overlay as SaveDashboardDrawer;

  const changeInfo: DashboardChangeInfo = {
    changedSaveModel: changedSaveModel ?? transformSceneToSaveModelSchemaV2(dashboard),
    initialSaveModel: transformSceneToSaveModel(dashboard),
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
