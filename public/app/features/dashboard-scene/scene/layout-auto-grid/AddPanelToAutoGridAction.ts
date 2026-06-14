import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { type DashboardEditActionEventPayload } from '../../edit-pane/events';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { AutoGridItem } from './AutoGridItem';
import { type AutoGridLayoutManager } from './AutoGridLayoutManager';

export class AddPanelToAutoGridAction implements DashboardEditActionEventPayload {
  public readonly source: AutoGridLayoutManager;
  public readonly addedObject: VizPanel;
  public readonly description: string;

  private readonly gridItem: AutoGridItem;

  public constructor(layoutManager: AutoGridLayoutManager, vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(layoutManager);
    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.source = layoutManager;
    this.addedObject = vizPanel;
    this.gridItem = new AutoGridItem({ body: vizPanel });
    this.description = t('dashboard.edit-actions.add', 'Add {{typeName}}', {
      typeName: t('dashboard.edit-pane.elements.panel', 'Panel'),
    });
  }

  public perform = (): void => {
    const layout = this.source.state.layout;
    layout.setState({ children: [...layout.state.children, this.gridItem] });
  };

  public undo = (): void => {
    const layout = this.source.state.layout;
    layout.setState({
      children: layout.state.children.filter((child) => child !== this.gridItem),
    });
  };
}
