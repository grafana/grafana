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

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true, disableTabsReason: 'nested-tabs' });
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

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true, disableTabsReason: 'nested-tabs' });
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

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true, disableTabsReason: 'nested-tabs' });
  });

  it('should disable tabs when the layout sits directly inside tabs, even with a deep subtree (tabs > rows > rows > rows)', () => {
    const level2Rows = new RowsLayoutManager({
      rows: [
        new RowItem({
          layout: new RowsLayoutManager({
            rows: [new RowItem({ layout: AutoGridLayoutManager.createEmpty() })],
          }),
        }),
      ],
    });
    buildTestScene(
      new TabsLayoutManager({
        tabs: [new TabItem({ layout: level2Rows })],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(level2Rows));

    // Adding a row just appends to the rows group, so grouping stays enabled
    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true, disableTabsReason: 'nested-tabs' });
  });

  it('should disable tabs with a max-depth reason when wrapping a rows subtree would exceed the maximum depth (rows > rows > rows > rows)', () => {
    // Wrapping the top-level rows group (subtree depth 4) in tabs would create a 5th layer,
    // even though no tabs are involved anywhere in the tree
    const topLevelRows = new RowsLayoutManager({
      rows: [
        new RowItem({
          layout: new RowsLayoutManager({
            rows: [
              new RowItem({
                layout: new RowsLayoutManager({
                  rows: [
                    new RowItem({
                      layout: new RowsLayoutManager({
                        rows: [new RowItem({ layout: AutoGridLayoutManager.createEmpty() })],
                      }),
                    }),
                  ],
                }),
              }),
            ],
          }),
        }),
      ],
    });
    buildTestScene(topLevelRows);

    const { result } = renderHook(() => useNestingRestrictions(topLevelRows));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: true, disableTabsReason: 'max-depth' });
  });

  it('should allow tabs when wrapping a group subtree still fits within the maximum depth (rows > rows)', () => {
    const innerRows = new RowsLayoutManager({
      rows: [new RowItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    buildTestScene(new RowsLayoutManager({ rows: [new RowItem({ layout: innerRows })] }));

    const { result } = renderHook(() => useNestingRestrictions(innerRows));

    expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
  });

  it('should allow adding a tab to a tabs layout at maximum depth but disable adding rows inside it (rows > rows > rows > tabs)', () => {
    const deepTabs = new TabsLayoutManager({
      tabs: [new TabItem({ layout: AutoGridLayoutManager.createEmpty() })],
    });
    buildTestScene(
      new RowsLayoutManager({
        rows: [
          new RowItem({
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  layout: new RowsLayoutManager({ rows: [new RowItem({ layout: deepTabs })] }),
                }),
              ],
            }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useNestingRestrictions(deepTabs));

    // Adding a tab appends to the existing tabs group (no new layer), but adding
    // a row would wrap the current tab's grid in a 5th group layer
    expect(result.current).toEqual({ disableGrouping: true, disableTabs: false });
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

    expect(result.current).toEqual({ disableGrouping: true, disableTabs: true, disableTabsReason: 'max-depth' });
  });
});
