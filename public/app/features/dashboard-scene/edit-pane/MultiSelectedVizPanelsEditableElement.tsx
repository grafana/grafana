import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { VizPanel } from '@grafana/scenes';
import { Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class MultiSelectedVizPanelsEditableElement implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Panels';
  public readonly key: string;

  constructor(private _panels: VizPanel[]) {
    this.key = uuidv4();
  }

  renderActions(): ReactNode {
    return (
      <Stack direction="column">
        <Text>
          <Trans
            i18nKey="dashboard.edit-pane.panels.multi-select.selection-number"
            values={{ length: this._panels.length }}
          >
            No. of panels selected: {{ length }}
          </Trans>
        </Text>
        <Stack direction="row">
          <Button size="sm" variant="secondary" icon="copy" />
          <Button size="sm" variant="destructive" fill="outline" onClick={() => this.onDelete()} icon="trash-alt" />
        </Stack>
      </Stack>
    );
  }

  public onDelete() {
    this._panels.forEach((panel) => {
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel?.(panel);
    });
  }
}
