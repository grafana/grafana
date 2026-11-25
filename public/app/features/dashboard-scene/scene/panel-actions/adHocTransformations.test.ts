import { type DataTransformerConfig } from '@grafana/data';
import { SceneDataTransformer, SceneFlexItem, SceneFlexLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { collectAdHocTransformations, restoreAdHocTransformations } from './adHocTransformations';

const hideA: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { A: true } } }];
const hideB: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { B: true } } }];
const renameA: DataTransformerConfig = { id: 'organize', options: { renameByName: { A: 'Renamed' } } };

interface PanelOptions {
  key?: string;
  pluginId?: string;
  saved?: DataTransformerConfig[] | null;
  adHoc?: DataTransformerConfig[];
}

function tree(...panels: PanelOptions[]) {
  return new SceneFlexLayout({
    children: panels.map(({ key = 'panel-1', pluginId = 'table', saved = [], adHoc = [] }) => {
      const body = new VizPanel({
        key,
        pluginId,
        $data: saved
          ? new SceneDataTransformer({ transformations: saved, $data: new SceneQueryRunner({ queries: [] }) })
          : undefined,
      });
      body.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, adHoc);
      return new SceneFlexItem({ body });
    }),
  });
}

function panelOf(layout: SceneFlexLayout, index = 0) {
  const item = layout.state.children[index];
  if (!(item instanceof SceneFlexItem) || !(item.state.body instanceof VizPanel)) {
    throw new Error('Expected a panel');
  }
  return item.state.body;
}

function adHocOf(layout: SceneFlexLayout, index = 0) {
  return panelOf(layout, index).getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER);
}

describe('restoreAdHocTransformations', () => {
  it('gives each panel that replaced a collected panel the ad hoc transformations the collected panel showed', () => {
    const current = collectAdHocTransformations(
      tree({ key: 'panel-1', adHoc: hideA }, { key: 'panel-2', adHoc: hideB })
    );
    const restored = tree({ key: 'panel-1' }, { key: 'panel-2' });

    restoreAdHocTransformations(restored, current);

    expect(adHocOf(restored, 0)).toEqual(hideA);
    expect(adHocOf(restored, 1)).toEqual(hideB);
  });

  it('does not give ad hoc transformations to a panel that shows another visualization', () => {
    const current = collectAdHocTransformations(tree({ adHoc: hideA }));
    const restored = tree({ pluginId: 'timeseries' });

    restoreAdHocTransformations(restored, current);

    expect(adHocOf(restored)).toEqual([]);
  });

  it('does not apply ad hoc transformations again when the restored panel already saved them', () => {
    const current = collectAdHocTransformations(tree({ adHoc: hideA }));
    const restored = tree({ saved: hideA });

    restoreAdHocTransformations(restored, current);

    expect(adHocOf(restored)).toEqual([]);
  });

  it('uses the baseline when the saved transformations changed since the baseline was taken', () => {
    const baseline = collectAdHocTransformations(tree({ adHoc: hideA }));
    const current = collectAdHocTransformations(tree({ saved: [renameA], adHoc: hideB }));
    const restored = tree({});

    restoreAdHocTransformations(restored, current, baseline);

    expect(adHocOf(restored)).toEqual(hideA);
  });

  it('uses the baseline for a panel that is no longer in the collected tree', () => {
    const baseline = collectAdHocTransformations(tree({ adHoc: hideA }));
    const current = collectAdHocTransformations(tree({ key: 'panel-2' }));
    const restored = tree({});

    restoreAdHocTransformations(restored, current, baseline);

    expect(adHocOf(restored)).toEqual(hideA);
  });

  it('prefers the current ad hoc transformations over the baseline, including removed ones', () => {
    const baseline = collectAdHocTransformations(
      tree({ key: 'panel-1', adHoc: hideA }, { key: 'panel-2', adHoc: hideA })
    );
    const current = collectAdHocTransformations(tree({ key: 'panel-1', adHoc: hideB }, { key: 'panel-2' }));
    const restored = tree({ key: 'panel-1' }, { key: 'panel-2' });

    restoreAdHocTransformations(restored, current, baseline);

    expect(adHocOf(restored, 0)).toEqual(hideB);
    expect(adHocOf(restored, 1)).toEqual([]);
  });

  it('treats a panel without a data transformer as having no saved transformations', () => {
    const current = collectAdHocTransformations(tree({ saved: null, adHoc: hideA }));
    const restored = tree({ saved: [] });

    restoreAdHocTransformations(restored, current);

    expect(adHocOf(restored)).toEqual(hideA);
  });

  it('matches saved transformations that differ only by empty fields', () => {
    const current = collectAdHocTransformations(tree({ saved: [renameA], adHoc: hideA }));
    const restored = tree({ saved: [{ ...renameA, disabled: undefined, filter: undefined, topic: undefined }] });

    restoreAdHocTransformations(restored, current);

    expect(adHocOf(restored)).toEqual(hideA);
  });

  it('leaves out the excluded panel', () => {
    const live = tree({ key: 'panel-1', adHoc: hideA }, { key: 'panel-2', adHoc: hideB });
    const restored = tree({ key: 'panel-1' }, { key: 'panel-2' });

    restoreAdHocTransformations(restored, collectAdHocTransformations(live, panelOf(live, 0)));

    expect(adHocOf(restored, 1)).toEqual(hideB);
    expect(adHocOf(restored, 0)).toEqual([]);
  });
});
