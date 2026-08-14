import { VizPanel } from '@grafana/scenes';

import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';

import { PanelModelCompatibilityWrapper } from './PanelModelCompatibilityWrapper';

describe('PanelModelCompatibilityWrapper', () => {
  it('Can get legacy id', () => {
    const vizPanel = new VizPanel({ pluginId: 'test', title: 'test', description: 'test', key: 'panel-24' });
    const panelModel = new PanelModelCompatibilityWrapper(vizPanel);
    expect(panelModel.id).toBe(24);
  });

  it('Can get legacy id for lib panel', () => {
    const panel = new VizPanel({ pluginId: 'test', title: 'test', description: 'test', key: 'panel-24' });

    const libPanel = new LibraryPanelBehavior({
      uid: 'a',
      name: 'aa',
    });

    panel.setState({
      $behaviors: [libPanel],
    });

    const panelModel = new PanelModelCompatibilityWrapper(panel);
    expect(panelModel.id).toBe(24);
  });
});
