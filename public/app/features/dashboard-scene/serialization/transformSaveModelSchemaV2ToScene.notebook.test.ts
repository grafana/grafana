import { type Spec as DashboardV2Spec, defaultPanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { handyTestingSchema } from '@grafana/schema/apis/dashboard.grafana.app/v2/examples';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { DashboardScene } from '../scene/DashboardScene';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn(),
  }),
}));

// F1 render spike (notebook-sibling-poc): proves a notebook-shaped v2 spec (Cell + Panel elements
// under a NotebookLayout) dispatches through the kind-agnostic transformer and materializes in a
// DashboardScene. This is a LOCAL kill-point — never pushed. F7 replaces the stub deserializer.
const notebookSpec: DashboardV2Spec = {
  ...handyTestingSchema,
  // The render spike only exercises elements + layout; drop the example dashboard's variables
  // so the test doesn't depend on variable-specific feature toggles.
  variables: [],
  elements: {
    'panel-1': {
      ...defaultPanelKind(),
      spec: {
        ...defaultPanelKind().spec,
        id: 1,
        title: 'A notebook panel',
      },
    },
    'cell-1': {
      kind: 'Cell',
      spec: {
        content: {
          kind: 'Markdown',
          spec: { text: '# Hello notebook' },
        },
      },
    },
  },
  layout: {
    kind: 'NotebookLayout',
    spec: {
      cells: [
        {
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, source: 'user' },
        },
        {
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'cell-1' }, source: 'user' },
        },
      ],
    },
  },
};

const notebookDashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'notebook-uid',
    namespace: 'default',
    labels: {},
    generation: 1,
    resourceVersion: '1',
    creationTimestamp: 'creationTs',
    annotations: {},
  },
  spec: notebookSpec,
  access: {
    url: '/notebook/abc',
    slug: 'a-notebook',
  },
  apiVersion: 'v2',
};

describe('transformSaveModelSchemaV2ToScene - notebook layout', () => {
  it('renders a notebook-shaped spec into a DashboardScene without throwing', () => {
    expect(() => transformSaveModelSchemaV2ToScene(notebookDashboard)).not.toThrow();
  });

  it('materializes both the panel and the cell as scene objects', () => {
    const scene = transformSaveModelSchemaV2ToScene(notebookDashboard);

    expect(scene).toBeInstanceOf(DashboardScene);
    // Both the panel element and the markdown cell should appear in the rendered layout.
    expect(scene.state.body.getVizPanels()).toHaveLength(2);
  });
});
