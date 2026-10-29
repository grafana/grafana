import { type DataTransformerConfig, DataTransformerID, ValueMatcherID } from '@grafana/data';
import {
  FilterByValueMatch,
  type FilterByValueTransformerOptions,
  FilterByValueType,
  type OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  SceneDataTransformer,
  SceneGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { type PanelKind } from '../../../../../packages/grafana-schema/src/schema/dashboard/v2';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('snapshot repeated panel titles (realistic, activated)', () => {
  it('bakes the display text (label) of a key:value variable, not the value', () => {
    // pod is a key:value custom variable: label "Bob"/"Rob", value "1"/"2".
    const pod = new CustomVariable({
      name: 'pod',
      query: 'Bob : 1, Rob : 2',
      isMulti: true,
      includeAll: true,
      value: ['1', '2'],
      text: ['Bob', 'Rob'],
    });

    const repeater = new DashboardGridItem({
      key: 'grid-item-1',
      variableName: 'pod',
      body: new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'pod = $pod' }),
    });

    const scene = new DashboardScene({
      title: 'Repeat',
      $variables: new SceneVariableSet({ variables: [pod] }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [repeater] }),
      }),
    });

    activateFullSceneTree(scene);

    // Sanity: the repeat produced clones with local variables carrying the label as text.
    expect(repeater.state.repeatedPanels?.length).toBe(1);

    const result = transformSceneToSaveModelSchemaV2(scene, true);
    const titles = Object.values(result.elements).map((e) => e.spec.title);

    expect(titles).toEqual(expect.arrayContaining(['pod = Bob', 'pod = Rob']));
    expect(titles).not.toContain('pod = 1');
    expect(titles).not.toContain('pod = 2');
  });
});

describe('snapshot repeated panel transformations', () => {
  const AS_SNAPSHOT = true;
  const AS_DASHBOARD = false;

  // Returns a filterByValue config that keeps only rows where the pod field equals ${pod}. Typed with
  // the real options interface, so this test stops compiling if that interface changes.
  function filterOnPod(): DataTransformerConfig<FilterByValueTransformerOptions> {
    return {
      id: DataTransformerID.filterByValue,
      options: {
        filters: [{ fieldName: 'pod', config: { id: ValueMatcherID.equal, options: { value: '${pod}' } } }],
        type: FilterByValueType.include,
        match: FilterByValueMatch.any,
      },
    };
  }

  // Returns an organize config that hides the field named pod-${pod}. organize holds field names in
  // excludeByName keys, which is why baking has to reach keys and not only values.
  function hidePodField(): DataTransformerConfig<OrganizeFieldsTransformerOptions> {
    return {
      id: DataTransformerID.organize,
      options: {
        excludeByName: { 'pod-${pod}': true },
        includeByName: {},
        indexByName: {},
        renameByName: {},
      },
    };
  }

  // pod is a key:value custom variable: label "Bob"/"Rob", value "1"/"2". Keeping the label and the
  // value different is what shows which of the two the options end up with.
  function buildScene(transformations: DataTransformerConfig[], variableName?: string) {
    const pod = new CustomVariable({
      name: 'pod',
      query: 'Bob : 1, Rob : 2',
      isMulti: true,
      includeAll: true,
      value: ['1', '2'],
      text: ['Bob', 'Rob'],
    });

    const repeater = new DashboardGridItem({
      key: 'grid-item-1',
      variableName,
      body: new VizPanel({
        key: 'panel-1',
        pluginId: 'timeseries',
        title: 'pod = $pod',
        $data: new SceneDataTransformer({
          transformations,
          $data: new SceneQueryRunner({ queries: [] }),
        }),
      }),
    });

    const scene = new DashboardScene({
      title: 'Repeat',
      $variables: new SceneVariableSet({ variables: [pod] }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [repeater] }),
      }),
    });

    activateFullSceneTree(scene);

    return scene;
  }

  function savedPanels(result: ReturnType<typeof transformSceneToSaveModelSchemaV2>) {
    return Object.values(result.elements).filter((element): element is PanelKind => element.kind === 'Panel');
  }

  function savedFilterValues(result: ReturnType<typeof transformSceneToSaveModelSchemaV2>) {
    return savedPanels(result).map(
      (panel) => panel.spec.data.spec.transformations[0].spec.options.filters[0].config.options.value
    );
  }

  it('filters each copy on its own pod value, while the title shows the pod label', () => {
    const scene = buildScene([filterOnPod()], 'pod');

    const result = transformSceneToSaveModelSchemaV2(scene, AS_SNAPSHOT);

    expect(
      savedPanels(result)
        .map((panel) => panel.spec.title)
        .sort()
    ).toEqual(['pod = Bob', 'pod = Rob']);
    expect(savedFilterValues(result).sort()).toEqual(['1', '2']);
  });

  it('hides a field whose name comes from the repeat variable', () => {
    const scene = buildScene([hidePodField()], 'pod');

    const result = transformSceneToSaveModelSchemaV2(scene, AS_SNAPSHOT);
    const hiddenFields = savedPanels(result).map(
      (panel) => Object.keys(panel.spec.data.spec.transformations[0].spec.options.excludeByName)[0]
    );

    expect(hiddenFields.sort()).toEqual(['pod-1', 'pod-2']);
  });

  it('keeps the variable when saving the dashboard instead of a snapshot', () => {
    const scene = buildScene([filterOnPod()], 'pod');

    const result = transformSceneToSaveModelSchemaV2(scene, AS_DASHBOARD);

    expect(savedFilterValues(result)).toEqual(['${pod}']);
  });

  it('does not change the dashboard the user is still looking at', () => {
    const scene = buildScene([filterOnPod()], 'pod');

    transformSceneToSaveModelSchemaV2(scene, AS_SNAPSHOT);
    const afterSnapshot = transformSceneToSaveModelSchemaV2(scene, AS_DASHBOARD);

    expect(savedFilterValues(afterSnapshot)).toEqual(['${pod}']);
  });

  it('keeps the variable in a panel that is not repeated', () => {
    const scene = buildScene([filterOnPod()]);

    const result = transformSceneToSaveModelSchemaV2(scene, AS_SNAPSHOT);

    expect(savedPanels(result)).toHaveLength(1);
    expect(savedFilterValues(result)).toEqual(['${pod}']);
  });
});
