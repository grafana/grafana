import { ConstantVariable, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { cloneSectionVariableSet, getCloneKey, getRenderedInstanceCount } from './clone';

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

  describe('getRenderedInstanceCount', () => {
    it('counts a panel that is not repeated once', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      new DashboardGridItem({ body: panel });

      expect(getRenderedInstanceCount(panel)).toBe(1);
    });

    it('counts the source panel plus the clones held by its grid item', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      new DashboardGridItem({
        body: panel,
        repeatedPanels: [
          new VizPanel({ key: getCloneKey('panel-1', 1), pluginId: 'timeseries' }),
          new VizPanel({ key: getCloneKey('panel-1', 2), pluginId: 'timeseries' }),
        ],
      });

      expect(getRenderedInstanceCount(panel)).toBe(3);
    });

    it('counts the source row plus its repeated rows', () => {
      const row = new RowItem({
        key: 'row-1',
        title: 'Row',
        repeatedRows: [new RowItem({ key: getCloneKey('row-1', 1), title: 'Row' })],
      });

      expect(getRenderedInstanceCount(row)).toBe(2);
    });

    it('counts the source tab plus its repeated tabs', () => {
      const tab = new TabItem({
        key: 'tab-1',
        title: 'Tab',
        repeatedTabs: [new TabItem({ key: getCloneKey('tab-1', 1), title: 'Tab' })],
      });

      expect(getRenderedInstanceCount(tab)).toBe(2);
    });
  });
});
