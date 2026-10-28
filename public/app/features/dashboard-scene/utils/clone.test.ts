import {
  ConstantVariable,
  type MultiValueVariable,
  SceneGridLayout,
  SceneVariableSet,
  TestVariable,
} from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { performRowRepeats } from '../scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { performTabRepeats } from '../scene/layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

import { cloneSectionVariableSet, getCloneKey, getRepeatSourceObject } from './clone';

function repeatVariable(name: string) {
  return new TestVariable({
    name,
    query: 'A.*',
    value: ['A', 'B'],
    text: ['A', 'B'],
    isMulti: true,
    optionsToReturn: [
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ],
  }) as unknown as MultiValueVariable;
}

function sectionData() {
  return new DashboardDataLayerSet({
    annotationLayers: [
      new DashboardAnnotationsDataLayer({ name: 'first', query: { name: 'first', enable: true, iconColor: 'red' } }),
      new DashboardAnnotationsDataLayer({ name: 'second', query: { name: 'second', enable: true, iconColor: 'red' } }),
    ],
  });
}

function emptyGrid() {
  return new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) });
}

function layersOf(section: RowItem | TabItem | undefined) {
  const set = section?.state.$data;
  if (!(set instanceof DashboardDataLayerSet)) {
    throw new Error('Section has no DashboardDataLayerSet');
  }
  return set.state.annotationLayers;
}

describe('clone', () => {
  describe('getCloneKey', () => {
    it('should return the clone key', () => {
      expect(getCloneKey('panel-1', 1)).toBe('panel-1-clone-1');
      expect(getCloneKey('panel-22', 1)).toBe('panel-22-clone-1');
    });
  });

  describe('cloneSectionVariableSet', () => {
    it('assigns new keys to the set and each variable', () => {
      const constant = new ConstantVariable({ name: 'env', value: 'prod' });
      const variableSet = new SceneVariableSet({ variables: [constant] });

      const cloned = cloneSectionVariableSet(variableSet);

      expect(cloned).not.toBe(variableSet);
      expect(cloned!.state.key).not.toBe(variableSet.state.key);
      expect(cloned!.state.variables[0]).not.toBe(constant);
      expect(cloned!.state.variables[0].state.key).not.toBe(constant.state.key);
      expect(cloned!.state.variables[0].state.name).toBe('env');
    });
  });

  describe('getRepeatSourceObject', () => {
    it('returns the object itself when it is not inside a repeat clone', () => {
      const row = new RowItem({ key: 'row-1', $data: sectionData(), layout: emptyGrid() });
      new DashboardScene({ body: new RowsLayoutManager({ rows: [row] }) });

      const layer = layersOf(row)[1];
      expect(getRepeatSourceObject(layer)).toBe(layer);
    });

    it('resolves a layer in a repeated row clone to the same layer in the source row', () => {
      const variable = repeatVariable('server');
      const row = new RowItem({ key: 'row-1', repeatByVariable: 'server', $data: sectionData(), layout: emptyGrid() });
      new DashboardScene({
        $variables: new SceneVariableSet({ variables: [variable] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      performRowRepeats(variable, row, true);

      const cloneLayer = layersOf(row.state.repeatedRows?.[0])[1];
      expect(cloneLayer).not.toBe(layersOf(row)[1]);
      expect(getRepeatSourceObject(cloneLayer)).toBe(layersOf(row)[1]);
    });

    it('resolves a layer in a repeated row nested inside a repeated tab clone to the outermost source', () => {
      const tabVariable = repeatVariable('region');
      const rowVariable = repeatVariable('server');
      const innerRow = new RowItem({
        key: 'row-1',
        repeatByVariable: 'server',
        $data: sectionData(),
        layout: emptyGrid(),
      });
      const tab = new TabItem({
        key: 'tab-1',
        repeatByVariable: 'region',
        layout: new RowsLayoutManager({ rows: [innerRow] }),
      });
      new DashboardScene({
        $variables: new SceneVariableSet({ variables: [tabVariable, rowVariable] }),
        body: new TabsLayoutManager({ tabs: [tab] }),
      });

      performTabRepeats(tabVariable, tab, true);
      const tabClone = tab.state.repeatedTabs![0];
      const innerRowInTabClone = (tabClone.state.layout as RowsLayoutManager).state.rows[0];
      performRowRepeats(rowVariable, innerRowInTabClone, true);

      const nestedCloneLayer = layersOf(innerRowInTabClone.state.repeatedRows?.[0])[1];
      expect(getRepeatSourceObject(nestedCloneLayer)).toBe(layersOf(innerRow)[1]);
      expect(getRepeatSourceObject(layersOf(innerRowInTabClone)[0])).toBe(layersOf(innerRow)[0]);
    });
  });
});
