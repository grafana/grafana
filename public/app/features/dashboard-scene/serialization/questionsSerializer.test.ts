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

import { getPickedPanelIds } from '../questions/questionSources';
import { getQuestionLabel } from '../questions/utils';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

describe('question sources', () => {
  it('pick panels by ID once loaded, and by the element names the dashboard saved them under once saved', () => {
    const prompts: Prompt[] = [{ text: 'Why did errors rise?', sources: [source('errors'), source('panel-1')] }];
    const scene = load(prompts);

    const loaded = [{ text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 1 }] }];
    expect(scene.state.questions).toEqual(loaded);
    expect(getRow(scene).state.questions).toEqual(loaded);

    const saved = transformSceneToSaveModelSchemaV2(scene);
    expect(saved.prompts).toEqual(prompts);
    expect(saved.layout.kind === 'RowsLayout' && saved.layout.spec.rows[0].spec.prompts).toEqual(prompts);
  });

  it('leave out an element the dashboard does not have when loaded', () => {
    const scene = load([
      { text: 'Why did errors rise?', sources: [source('errors'), source('panel-9')] },
      { text: 'What stands out?', sources: [source('panel-9')] },
    ]);

    // With none of its picked panels left, a question is answered from every panel.
    expect(scene.state.questions).toEqual([
      { text: 'Why did errors rise?', sources: [{ panelId: 3 }] },
      { text: 'What stands out?' },
    ]);
  });

  it('leave out a panel removed from the dashboard when saved', () => {
    const scene = load([]);
    scene.setState({ questions: [{ text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 9 }] }] });

    expect(transformSceneToSaveModelSchemaV2(scene).prompts).toEqual([
      { text: 'Why did errors rise?', sources: [source('errors')] },
    ]);
  });
});

// Nothing checks a spec applied through the mutation API, so a question can arrive as something the schema forbids.
describe('saved questions that do not follow the schema', () => {
  it('load with sources that are not a list left out, so the question is answered from every panel', () => {
    const scene = load(
      malformed(
        { text: 'Why did errors rise?', sources: 'errors' },
        { text: 'What stands out?', sources: { element: source('errors').element } }
      )
    );

    expect(scene.state.questions).toEqual([{ text: 'Why did errors rise?' }, { text: 'What stands out?' }]);
    expect(getRow(scene).state.questions).toEqual(scene.state.questions);
    // A new panel's ID is chosen from the picked ones, so a question that picked none must leave nothing to read.
    expect(getPickedPanelIds(scene)).toEqual([]);
  });

  it('load with a title that is not a string left out, so viewers see the question', () => {
    const scene = load(
      malformed(
        { text: 'Why did errors rise?', title: 5 },
        { text: 'What stands out?', title: { text: 'Stands out' } },
        { text: 'Which endpoints got slower?', title: 'Latency' }
      )
    );

    expect(scene.state.questions).toEqual([
      { text: 'Why did errors rise?' },
      { text: 'What stands out?' },
      { text: 'Which endpoints got slower?', title: 'Latency' },
    ]);
    expect(scene.state.questions?.map(getQuestionLabel)).toEqual([
      'Why did errors rise?',
      'What stands out?',
      'Latency',
    ]);
  });
});

function source(name: string): PromptSource {
  return { element: { kind: 'ElementReference', name } };
}

/** Prompts as JSON that does not follow the schema, which the `Prompt` type can't express. */
function malformed(...prompts: Array<Record<string, unknown>>): Prompt[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the point is a value the type forbids
  return prompts as unknown as Prompt[];
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
