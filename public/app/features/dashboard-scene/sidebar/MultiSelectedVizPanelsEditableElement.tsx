import { generateUUID } from '@grafana/data';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { removePanels } from '../actions/layout/removePanels';
import { type DashboardScene } from '../scene/DashboardScene';
import { getGroupSelectedCategory } from '../scene/layouts-shared/GroupSelectedActions';
import { type BulkActionElement } from '../scene/types/BulkActionElement';
import {
  type EditActionSource,
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../scene/types/EditableDashboardElement';
import { getRenderedInstanceCount } from '../utils/clone';

export class MultiSelectedVizPanelsEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly key: string;

  constructor(
    private _panels: BulkActionElement[],
    private _dashboard: DashboardScene
  ) {
    this.key = generateUUID();
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const count = this.getPanels().reduce((total, panel) => total + getRenderedInstanceCount(panel), 0);

    return {
      typeName: t('dashboard.sidebar.elements.selected-panels', '', {
        count,
        defaultValue_one: '{{count}} panel',
        defaultValue_other: '{{count}} panels',
      }),
      icon: 'folder',
      instanceName: '',
    };
  }

  public useSidebarOptions(): OptionsPaneCategoryDescriptor[] {
    return [getGroupSelectedCategory(this.getPanels())];
  }

  public getPanels(): VizPanel[] {
    return this._panels
      .map((panel) => ('panel' in panel ? panel.panel : undefined))
      .filter((panel): panel is VizPanel => panel instanceof VizPanel);
  }

  public onConfirmDelete() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.sidebar.elements.multiple-panels', 'Multiple panels'),
        text: t(
          'dashboard.sidebar.elements.multiple-panels-delete-text',
          'Are you sure you want to delete these panels? All queries will be removed.'
        ),
        onConfirm: () => this.onDelete(),
      })
    );
  }

  public onDelete(source: EditActionSource = 'edit_pane') {
    removePanels(this._dashboard, this.getPanels(), source);
  }
}
