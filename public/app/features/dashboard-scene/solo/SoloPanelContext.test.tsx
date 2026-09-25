import { LocalValueVariable, SceneCSSGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { SoloPanelContextWithPathIdFilter } from './SoloPanelContext';

describe('SoloPanelContextWithPathIdFilter', () => {
  describe('matches()', () => {
    it('should match panel whose key equals panel-{id}', () => {
      const filter = new SoloPanelContextWithPathIdFilter('42');
      const panel = new VizPanel({ key: 'panel-42', pluginId: 'text' });
      expect(filter.matches(panel)).toBe(true);
    });

    it('should set matchFound to true on a successful match', () => {
      const filter = new SoloPanelContextWithPathIdFilter('1');
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      filter.matches(panel);
      expect(filter.matchFound).toBe(true);
    });

    it('should add the matched panel to matchedPanels', () => {
      const filter = new SoloPanelContextWithPathIdFilter('1');
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      filter.matches(panel);
      expect(filter.matchedPanels).toContain(panel);
    });

    it('should return false when key does not match', () => {
      const filter = new SoloPanelContextWithPathIdFilter('1');
      const panel = new VizPanel({ key: 'panel-2', pluginId: 'text' });
      expect(filter.matches(panel)).toBe(false);
    });

    it('should match panel whose getPathId() equals keyPath', () => {
      const filter = new SoloPanelContextWithPathIdFilter('US1$panel-1');
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });

      new SceneCSSGridLayout({
        children: [panel],
        $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'server', value: 'US1' })] }),
      });

      expect(filter.matches(panel)).toBe(true);
    });

    it('should accumulate multiple different matched panels', () => {
      const filter = new SoloPanelContextWithPathIdFilter('panel-1');
      const panel1 = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const panel2 = new VizPanel({ key: 'panel-1', pluginId: 'graph' });
      filter.matches(panel1);
      filter.matches(panel2);
      expect(filter.matchedPanels).toHaveLength(2);
    });
  });
});
