import {
  defaultPanelSpec,
  defaultSpec,
  type GridLayoutItemKind,
  type PanelKind,
  type Prompt,
  type PromptSource,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

describe('prompt sources', () => {
  it('pick panels by ID once loaded, and by the element names the dashboard saved them under once saved', () => {
    const prompts: Prompt[] = [{ text: 'Why did errors rise?', sources: [source('errors'), source('panel-1')] }];
    const scene = load(prompts);

    const loaded = [{ text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 1 }] }];
    expect(scene.state.prompts).toEqual(loaded);
    expect(getRow(scene).state.prompts).toEqual(loaded);

    const saved = transformSceneToSaveModelSchemaV2(scene);
    expect(saved.prompts).toEqual(prompts);
    expect(saved.layout.kind === 'RowsLayout' && saved.layout.spec.rows[0].spec.prompts).toEqual(prompts);
  });

  it('leave out an element the dashboard does not have when loaded', () => {
    const scene = load([
      { text: 'Why did errors rise?', sources: [source('errors'), source('panel-9')] },
      { text: 'What stands out?', sources: [source('panel-9')] },
    ]);

    // With none of its picked panels left, a prompt is answered from every panel.
    expect(scene.state.prompts).toEqual([
      { text: 'Why did errors rise?', sources: [{ panelId: 3 }] },
      { text: 'What stands out?' },
    ]);
  });

  it('leave out a panel removed from the dashboard when saved', () => {
    const scene = load([]);
    scene.setState({ prompts: [{ text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 9 }] }] });

    expect(transformSceneToSaveModelSchemaV2(scene).prompts).toEqual([
      { text: 'Why did errors rise?', sources: [source('errors')] },
    ]);
  });
});

function source(name: string): PromptSource {
  return { element: { kind: 'ElementReference', name } };
}

function panel(id: number, title: string): PanelKind {
  return { kind: 'Panel', spec: { ...defaultPanelSpec(), id, title } };
}

function gridItem(name: string, y: number): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: { x: 0, y, width: 12, height: 8, element: { kind: 'ElementReference', name } },
  };
}

/**
 * A dashboard with a "Requests" panel saved as "panel-1", and an "Error rate" panel saved under the name "errors",
 * both in one row. The prompts are saved on the dashboard and on the row.
 */
function load(prompts: Prompt[]) {
  const dashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'v2',
    metadata: { name: 'checkout', resourceVersion: '1', creationTimestamp: '', generation: 1 },
    access: {},
    spec: {
      ...defaultSpec(),
      title: 'Checkout',
      prompts,
      elements: { 'panel-1': panel(1, 'Requests'), errors: panel(3, 'Error rate') },
      layout: {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Errors',
                collapse: false,
                prompts,
                layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1', 0), gridItem('errors', 8)] } },
              },
            },
          ],
        },
      },
    },
  };
  return transformSaveModelSchemaV2ToScene(dashboard);
}

function getRow(scene: ReturnType<typeof load>) {
  const { body } = scene.state;
  if (!(body instanceof RowsLayoutManager)) {
    throw new Error('The fixture lays out rows');
  }
  return body.state.rows[0];
}
