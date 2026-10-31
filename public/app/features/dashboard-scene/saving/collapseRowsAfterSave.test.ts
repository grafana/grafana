import {
  defaultSpec as defaultDashboardV2Spec,
  type RowsLayoutRowKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { JsonModelEditView } from '../settings/JsonModelEditView';

import { collapseRowsAfterSave } from './collapseRowsAfterSave';

type Layout = DashboardV2Spec['layout'];

const grid: Layout = { kind: 'GridLayout', spec: { items: [] } };

const row = (
  title: string,
  spec: Partial<RowsLayoutRowKind['spec']> = {},
  layout: Layout = grid
): RowsLayoutRowKind => ({
  kind: 'RowsLayoutRow',
  spec: { title, collapse: false, layout, ...spec },
});

const rows = (items: RowsLayoutRowKind[]): Layout => ({ kind: 'RowsLayout', spec: { rows: items } });

function buildScene(layout: Layout) {
  return transformSaveModelSchemaV2ToScene({
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'DashboardWithAccessInfo',
    spec: { ...defaultDashboardV2Spec(), title: 'Rows', layout },
    metadata: { name: 'rows-uid', generation: 1, resourceVersion: '1', creationTimestamp: '2026-01-01T00:00:00Z' },
    access: {},
  });
}

function collapseByTitle(layout: Layout, result: Record<string, boolean | undefined> = {}) {
  if (layout.kind === 'RowsLayout') {
    for (const item of layout.spec.rows) {
      result[item.spec.title ?? ''] = item.spec.collapse;
      collapseByTitle(item.spec.layout, result);
    }
  }
  if (layout.kind === 'TabsLayout') {
    for (const tab of layout.spec.tabs) {
      collapseByTitle(tab.spec.layout, result);
    }
  }
  return result;
}

describe('collapseRowsAfterSave', () => {
  it('collapses every live row with a header, including rows nested in rows and tabs', () => {
    const scene = buildScene(
      rows([
        row('top'),
        row('already collapsed', { collapse: true }),
        row('outer', {}, rows([row('row in row')])),
        row(
          'tabs holder',
          {},
          {
            kind: 'TabsLayout',
            spec: { tabs: [{ kind: 'TabsLayoutTab', spec: { title: 'tab', layout: rows([row('row in tab')]) } }] },
          }
        ),
        row('hidden', { hideHeader: true }),
      ])
    );

    collapseRowsAfterSave(scene);

    expect(collapseByTitle(transformSceneToSaveModelSchemaV2(scene).layout)).toEqual({
      top: true,
      'already collapsed': true,
      outer: true,
      'row in row': true,
      'tabs holder': true,
      'row in tab': true,
      hidden: false,
    });
  });

  it('also collapses the rows in an open JSON Model editor', () => {
    const scene = buildScene(
      rows([row('top'), row('outer', {}, rows([row('row in row')])), row('hidden', { hideHeader: true })])
    );
    const view = new JsonModelEditView({});
    scene.setState({ editview: view });
    view.setState({ jsonText: view.getJsonText() });

    collapseRowsAfterSave(scene);

    const edited = view.getEditedSaveModel();
    expect('layout' in edited && collapseByTitle(edited.layout)).toEqual({
      top: true,
      outer: true,
      'row in row': true,
      hidden: false,
    });
  });

  it('leaves unparseable JSON Model editor text as it is', () => {
    const scene = buildScene(rows([row('top')]));
    const view = new JsonModelEditView({});
    scene.setState({ editview: view });
    view.setState({ jsonText: '{ not json' });

    collapseRowsAfterSave(scene);

    expect(view.state.jsonText).toBe('{ not json');
    expect(collapseByTitle(transformSceneToSaveModelSchemaV2(scene).layout)).toEqual({ top: true });
  });

  it('leaves a dashboard without rows unchanged', () => {
    const scene = buildScene(grid);
    const before = transformSceneToSaveModelSchemaV2(scene);

    collapseRowsAfterSave(scene);

    expect(transformSceneToSaveModelSchemaV2(scene)).toEqual(before);
  });
});
