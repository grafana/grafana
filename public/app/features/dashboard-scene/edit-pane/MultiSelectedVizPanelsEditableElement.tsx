import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { renderTitle } from './shared';

export class MultiSelectedVizPanelsEditableElement implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Panels';
  public readonly key: string;
  public readonly alwaysExpanded = true;

  constructor(private _panels: VizPanel[]) {
    this.key = uuidv4();
  }

  public renderActions(): ReactNode {
    return <></>;
  }

  public renderTitle: () => ReactNode = () => {
    return renderTitle({
      title: `${this._panels.length} ${t('dashboard.layout.common.panels', 'Panels')} ${t('dashboard.layout.common.selected', 'Selected')}`,
      onDelete: this.onDelete,
    });
  };

  public onDelete = () => {
    this._panels.forEach((panel) => {
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel?.(panel);
    });
  };
}
