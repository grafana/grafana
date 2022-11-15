import { PanelPlugin } from '@grafana/data';

import { VizPanel } from './VizPanel';

let pluginToLoad: PanelPlugin | null = null;

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: jest.fn(() => pluginToLoad),
}));

describe('VizPanel', () => {
  describe('when activated', () => {
    it('should run queries', () => {
      const panel = new VizPanel({
        pluginId: 'timeseries',
      });
    });
  });
});
