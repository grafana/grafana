import { VizPanel } from '@grafana/scenes';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';

import { PanelModelCompatibilityWrapper } from './PanelModelCompatibilityWrapper';

describe('PanelModelCompatibilityWrapper', () => {
  it('Can get legacy id', () => {
    const vizPanel = new VizPanel({ pluginId: 'test', title: 'test', description: 'test', key: 'panel-24' });
    const panelModel = new PanelModelCompatibilityWrapper(vizPanel);
    expect(panelModel.id).toBe(24);
  });

  it('Can get legacy id for lib panel', () => {
    const libPanel = new LibraryVizPanel({
      uid: 'a',
      name: 'aa',
      title: 'a',
      panelKey: 'panel-24',
      panel: new VizPanel({ pluginId: 'test', title: 'test', description: 'test', key: 'panel-24' }),
    });

    const panelModel = new PanelModelCompatibilityWrapper(libPanel.state.panel!);
    expect(panelModel.id).toBe(24);
  });
});
