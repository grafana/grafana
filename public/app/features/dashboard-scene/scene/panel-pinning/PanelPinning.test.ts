import { VizPanel } from '@grafana/scenes';

import { V1DashboardSerializer, V2DashboardSerializer } from '../../serialization/DashboardSceneSerializer';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { PanelPinning } from './PanelPinning';

describe('PanelPinning', () => {
  it('replaces the pinned panel and clears it only when its source is removed', () => {
    const pinning = new PanelPinning();
    const first = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const second = new VizPanel({ key: 'panel-2', pluginId: 'text' });
    const firstOrigin = document.createElement('div');
    const secondOrigin = document.createElement('div');
    jest.spyOn(firstOrigin, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 280,
      top: 0,
      right: 500,
      bottom: 280,
      left: 0,
      toJSON: () => ({}),
    });
    const removeFirst = pinning.register(first, firstOrigin);
    const removeSecond = pinning.register(second, secondOrigin);

    pinning.pin(first);
    expect(pinning.getSnapshot()).toEqual({ panel: first, height: 280, aspectRatio: '500 / 280' });
    pinning.pin(second);
    expect(pinning.getSnapshot()).toEqual({ panel: second, height: 100 });
    removeFirst();
    expect(pinning.getSnapshot()?.panel).toBe(second);
    removeSecond();
    expect(pinning.getSnapshot()).toBeNull();
  });

  it('restores normal viewing when disabled and rejects pinning until re-enabled', () => {
    const pinning = new PanelPinning();
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    pinning.register(panel, document.createElement('div'));
    pinning.pin(panel);
    expect(pinning.getSnapshot()?.panel).toBe(panel);

    pinning.setEnabled(false);
    expect(pinning.getSnapshot()).toBeNull();
    expect(pinning.canPin(panel)).toBe(false);
    pinning.pin(panel);
    expect(pinning.getSnapshot()).toBeNull();
    pinning.setEnabled(true);
    pinning.pin(panel);
    expect(pinning.getSnapshot()?.panel).toBe(panel);
  });

  it.each([new V1DashboardSerializer(), new V2DashboardSerializer()])(
    'leaves dashboard serialization and dirty state unchanged with %p',
    (serializer) => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', title: 'Search' });
      const dashboard = new DashboardScene({
        title: 'Operations',
        isDirty: false,
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });
      const before = serializer.getSaveModel(dashboard);
      const pinning = new PanelPinning();
      pinning.register(panel, document.createElement('div'));
      pinning.pin(panel);

      expect(pinning.getSnapshot()?.panel).toBe(panel);
      expect(serializer.getSaveModel(dashboard)).toEqual(before);
      expect(dashboard.state.isDirty).toBe(false);
    }
  );
});
