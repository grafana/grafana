import { ReactNode, useMemo } from 'react';

import { sceneGraph, VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
} from '../panel-edit/getPanelFrameOptions';
import { BulkActionElement } from '../scene/types/BulkActionElement';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class VizPanelEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private panel: VizPanel) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeId: 'panel',
      icon: 'chart-line',
      name: sceneGraph.interpolate(this.panel, this.panel.state.title, undefined, 'text'),
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const panel = this.panel;
    const layoutElement = panel.parent!;

    const panelOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: t('dashboard.viz-panel.options.title', 'Panel options'),
        id: 'panel-options',
        isOpenDefault: true,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.title-option', 'Title'),
            value: panel.state.title,
            popularRank: 1,
            render: function renderTitle() {
              return <PanelFrameTitleInput panel={panel} />;
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.description', 'Description'),
            value: panel.state.description,
            render: function renderDescription() {
              return <PanelDescriptionTextArea panel={panel} />;
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.transparent-background', 'Transparent background'),
            render: function renderTransparent() {
              return <PanelBackgroundSwitch panel={panel} />;
            },
          })
        );
    }, [panel]);

    const layoutCategory = useMemo(() => {
      if (isDashboardLayoutItem(layoutElement) && layoutElement.getOptions) {
        return layoutElement.getOptions();
      }
      return undefined;
    }, [layoutElement]);

    const { options, fieldConfig, _pluginInstanceState } = panel.useState();
    const dataProvider = sceneGraph.getData(panel);
    const { data } = dataProvider.useState();

    const visualizationOptions = useMemo(() => {
      const plugin = panel.getPlugin();
      if (!plugin) {
        return [];
      }

      return getVisualizationOptions2({
        panel,
        data,
        plugin: plugin,
        eventBus: panel.getPanelContext().eventBus,
        instanceState: _pluginInstanceState,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, panel, options, fieldConfig, _pluginInstanceState]);

    const categories = [panelOptions];
    if (layoutCategory) {
      categories.push(layoutCategory);
    }

    categories.push(...visualizationOptions);

    return categories;
  }

  public onDelete = () => {
    const layout = dashboardSceneGraph.getLayoutManagerFor(this.panel);
    layout.removePanel?.(this.panel);
  };

  public renderActions(): ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary">
          <Trans i18nKey="panel.header-menu.edit">Edit</Trans>
        </Button>
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
      </>
    );
  }
}
