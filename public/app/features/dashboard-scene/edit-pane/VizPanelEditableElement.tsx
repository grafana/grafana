import { useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { Stack, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
} from '../panel-edit/getPanelFrameOptions';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { AutoGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { BulkActionElement } from '../scene/types/BulkActionElement';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { MultiSelectedVizPanelsEditableElement } from './MultiSelectedVizPanelsEditableElement';

export class VizPanelEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Panel';

  public constructor(public panel: VizPanel) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.panel', 'Panel'),
      icon: 'chart-line',
      instanceName: sceneGraph.interpolate(this.panel, this.panel.state.title, undefined, 'text'),
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const panel = this.panel;
    const layoutElement = panel.parent!;

    const panelOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({ title: '', id: 'panel-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            render: () => <OpenPanelEditViz panel={this.panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.title-option', 'Title'),
            value: panel.state.title,
            popularRank: 1,
            render: () => <PanelFrameTitleInput panel={panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.description', 'Description'),
            value: panel.state.description,
            render: () => <PanelDescriptionTextArea panel={panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.transparent-background', 'Transparent background'),
            render: () => <PanelBackgroundSwitch panel={panel} />,
          })
        );
    }, [panel]);

    const layoutCategories = useMemo(
      () => (isDashboardLayoutItem(layoutElement) && layoutElement.getOptions ? layoutElement.getOptions() : []),
      [layoutElement]
    );

    return [panelOptions, ...layoutCategories];
  }

  public onDelete() {
    const layout = dashboardSceneGraph.getLayoutManagerFor(this.panel);
    layout.removePanel?.(this.panel);
  }

  public onDuplicate() {
    const layout = dashboardSceneGraph.getLayoutManagerFor(this.panel);
    layout.duplicatePanel?.(this.panel);
  }

  public onCopy() {
    const dashboard = getDashboardSceneFor(this.panel);
    dashboard.copyPanel(this.panel);
  }

  public createMultiSelectedElement(items: VizPanelEditableElement[]) {
    return new MultiSelectedVizPanelsEditableElement(items);
  }

  public scrollIntoView() {
    if (this.panel.parent instanceof AutoGridItem) {
      this.panel.parent.scrollIntoView();
    }
    if (this.panel.parent instanceof DashboardGridItem) {
      this.panel.parent.scrollIntoView();
    }
  }
}

type OpenPanelEditVizProps = {
  panel: VizPanel;
};

const OpenPanelEditViz = ({ panel }: OpenPanelEditVizProps) => {
  return (
    <Stack alignItems="center" width="100%">
      <Button
        onClick={() => {
          locationService.partial({ editPanel: getPanelIdForVizPanel(panel) });
        }}
        icon="sliders-v-alt"
        fullWidth
        size="sm"
        tooltip={t('dashboard.viz-panel.options.configure-button-tooltip', 'Edit queries and visualization options')}
      >
        <Trans i18nKey="dashboard.new-panel.configure-button">Configure</Trans>
      </Button>
    </Stack>
  );
};
