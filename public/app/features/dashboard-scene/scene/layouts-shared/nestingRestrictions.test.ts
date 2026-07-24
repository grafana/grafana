import { renderHook } from '@testing-library/react';

import { SceneTimeRange } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { useNestingRestrictions } from '../layouts-shared/nestingRestrictions';

function buildTestScene(body?: DashboardScene['state']['body']) {
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body:
      body ??
      new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'test tab',
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  title: 'Test Title',
                  layout: new TabsLayoutManager({
                    tabs: [new TabItem({ title: 'Subtab' })],
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
  });
  activateFullSceneTree(scene);
  return scene;
}

describe('useNestingRestrictions', () => {
  it('should allow both grouping and tabs at the top level', () => {
    const { body: layoutManager } = buildTestScene(AutoGridLayoutManager.createEmpty()).state;

    const { result } = renderHook(() => useNestingRestrictions(layoutManager));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should allow both grouping and tabs when nested one level inside rows', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }));

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should disable tabs but allow grouping when nested one level inside tabs', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(new TabsLayoutManager({ tabs: [new TabItem({ layout: innerLayout })] }));

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
  });

  it('should allow both grouping and tabs when nested two levels deep (rows > rows)', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new RowsLayoutManager({
        rows: [
          new RowItem({
            layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should allow both grouping and tabs when nested two levels deep (tabs > rows)', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new TabsLayoutManager({
        tabs: [
          new TabItem({
            layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should allow grouping but disable tabs when nested two levels deep (rows > tabs)', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new RowsLayoutManager({
        rows: [
          new RowItem({
            layout: new TabsLayoutManager({ tabs: [new TabItem({ layout: innerLayout })] }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
  });

  it('should allow both grouping and tabs when nested three levels deep (rows > rows > rows)', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new RowsLayoutManager({
        rows: [
          new RowItem({
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
                }),
              ],
            }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should disable tabs but allow grouping when the closest ancestor is tabs, however deep (tabs > rows > tabs)', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new TabsLayoutManager({
        tabs: [
          new TabItem({
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  layout: new TabsLayoutManager({ tabs: [new TabItem({ layout: innerLayout })] }),
                }),
              ],
            }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
  });

  it('should disable both grouping and tabs when nested four levels deep', () => {
    const innerLayout = AutoGridLayoutManager.createEmpty();
    buildTestScene(
      new RowsLayoutManager({
        rows: [
          new RowItem({
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  layout: new RowsLayoutManager({
                    rows: [
                      new RowItem({
                        layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
                      }),
                    ],
                  }),
                }),
              ],
            }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(innerLayout));

    expect(result.current).toEqual({ disableGrouping: true, disableTabs: true });
  });
});
