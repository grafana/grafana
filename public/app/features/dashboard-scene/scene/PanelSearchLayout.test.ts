import { VizPanel, sceneGraph } from '@grafana/scenes';

import { SoloPanelContextValueWithSearchStringFilter } from './PanelSearchLayout';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    interpolate: jest.fn((_panel, str) => str),
  },
}));

function makePanel(title: string): VizPanel {
  const panel = new VizPanel({ title });
  jest.spyOn(panel, 'interpolate').mockReturnValue(title);
  return panel;
}

describe('SoloPanelContextValueWithSearchStringFilter', () => {
  describe('string matching (fallback)', () => {
    it('matches when title contains the search string', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('cpu');
      expect(filter.matches(makePanel('CPU Usage'))).toBe(true);
    });

    it('does not match when title does not contain the search string', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('memory');
      expect(filter.matches(makePanel('CPU Usage'))).toBe(false);
    });

    it('is case-insensitive', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('CPU');
      expect(filter.matches(makePanel('cpu usage'))).toBe(true);
    });

    it('sets matchFound to true when a match occurs', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('cpu');
      expect(filter.matchFound).toBe(false);
      filter.matches(makePanel('CPU Usage'));
      expect(filter.matchFound).toBe(true);
    });

    it('does not set matchFound when no match occurs', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('memory');
      filter.matches(makePanel('CPU Usage'));
      expect(filter.matchFound).toBe(false);
    });
  });

  describe('regex matching', () => {
    it('matches using alternation', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('cpu|memory');
      expect(filter.matches(makePanel('Memory Usage'))).toBe(true);
      expect(filter.matches(makePanel('CPU Usage'))).toBe(true);
      expect(filter.matches(makePanel('Disk Usage'))).toBe(false);
    });

    it('matches using start anchor', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('^CPU');
      expect(filter.matches(makePanel('CPU Usage'))).toBe(true);
      expect(filter.matches(makePanel('Total CPU'))).toBe(false);
    });

    it('matches using end anchor', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('rate$');
      expect(filter.matches(makePanel('Error rate'))).toBe(true);
      expect(filter.matches(makePanel('rate limiter'))).toBe(false);
    });

    it('matches using wildcard pattern', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('error.*rate');
      expect(filter.matches(makePanel('error request rate'))).toBe(true);
      expect(filter.matches(makePanel('error rate'))).toBe(true);
      expect(filter.matches(makePanel('request rate'))).toBe(false);
    });

    it('is case-insensitive', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('^CPU');
      expect(filter.matches(makePanel('cpu usage'))).toBe(true);
    });

    it('sets matchFound to true on regex match', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('cpu|memory');
      expect(filter.matchFound).toBe(false);
      filter.matches(makePanel('Memory Usage'));
      expect(filter.matchFound).toBe(true);
    });
  });

  describe('invalid regex fallback', () => {
    it('falls back to string match for invalid regex', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('(unclosed');
      expect(filter.matches(makePanel('(unclosed bracket panel'))).toBe(true);
      expect(filter.matches(makePanel('normal panel'))).toBe(false);
    });

    it('falls back to string match for unescaped bracket', () => {
      const filter = new SoloPanelContextValueWithSearchStringFilter('[invalid');
      expect(filter.matches(makePanel('panel [invalid title'))).toBe(true);
      expect(filter.matches(makePanel('normal panel'))).toBe(false);
    });
  });

  describe('interpolation', () => {
    it('interpolates the search string before matching', () => {
      const panel = makePanel('CPU Usage');
      (sceneGraph.interpolate as jest.Mock).mockReturnValueOnce('cpu');

      const filter = new SoloPanelContextValueWithSearchStringFilter('$var');
      expect(filter.matches(panel)).toBe(true);
      expect(sceneGraph.interpolate).toHaveBeenCalledWith(panel, '$var');
    });

    it('interpolates the panel title before matching', () => {
      const panel = new VizPanel({ title: '$metric Usage' });
      jest.spyOn(panel, 'interpolate').mockReturnValue('CPU Usage');

      const filter = new SoloPanelContextValueWithSearchStringFilter('cpu');
      expect(filter.matches(panel)).toBe(true);
      expect(panel.interpolate).toHaveBeenCalledWith('$metric Usage', undefined, 'text');
    });
  });
});
