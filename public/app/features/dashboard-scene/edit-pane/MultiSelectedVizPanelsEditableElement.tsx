import { ReactNode } from 'react';

import { SceneObject, VizPanel } from '@grafana/scenes';
import { Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class MultiSelectedVizPanelsEditableElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;

  private items?: VizPanel[];

  constructor(items: SceneObject[]) {
    this.items = [];

    for (const item of items) {
      if (item instanceof VizPanel) {
        this.items.push(item);
      }
    }
  }

  useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public onDelete = () => {
    for (const panel of this.items || []) {
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel(panel);
    }
  };

  public getTypeName(): string {
    return 'Panels';
  }

  renderActions(): ReactNode {
    return (
      <Stack direction="column">
        <Text>
          <Trans i18nKey="dashboard.edit-pane.panels.multi-select.selection-number">No. of panels selected: </Trans>
          {this.items?.length}
        </Text>
        <Stack direction="row">
          <Button size="sm" variant="secondary" icon="copy" />
          <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
        </Stack>
      </Stack>
    );
  }
}
