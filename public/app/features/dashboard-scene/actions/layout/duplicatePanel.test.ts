import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { duplicateDefaultGridPanel } from './duplicateDefaultGridPanel';
import { duplicatePanel } from './duplicatePanel';

jest.mock('./duplicateDefaultGridPanel');

describe('duplicatePanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('routes Default grid panels to the extracted action', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'table' });
    const layout = DefaultGridLayoutManager.fromVizPanels([panel]);
    new DashboardScene({ body: layout });

    duplicatePanel(panel);

    expect(duplicateDefaultGridPanel).toHaveBeenCalledWith(layout, panel);
    expect(duplicateDefaultGridPanel).toHaveBeenCalledTimes(1);
  });

  it('keeps Auto grid panels using their existing layout method', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'table' });
    const layout = new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }),
    });
    new DashboardScene({ body: layout });
    const duplicate = jest.spyOn(layout, 'duplicatePanel').mockImplementation();

    duplicatePanel(panel);

    expect(duplicate).toHaveBeenCalledWith(panel);
    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(duplicateDefaultGridPanel).not.toHaveBeenCalled();
  });
});
