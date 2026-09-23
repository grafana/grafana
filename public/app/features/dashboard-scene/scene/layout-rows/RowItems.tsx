import { t } from '@grafana/i18n';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { endBatch, startBatch } from '../../actions/utils/batch';
import { type DashboardScene } from '../DashboardScene';
import { type EditableDashboardElementInfo, type EditableDashboardElement } from '../types/EditableDashboardElement';

import { type RowItem } from './RowItem';
import { getSidebarOptions } from './RowItemsEditor';

export class RowItems implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(
    private _rows: RowItem[],
    private _dashboard: DashboardScene
  ) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.sidebar.elements.rows', 'Rows'), icon: 'folder', instanceName: '' };
  }

  public useSidebarOptions(): OptionsPaneCategoryDescriptor[] {
    return getSidebarOptions(this);
  }

  public getRows(): RowItem[] {
    return this._rows;
  }

  public onDelete() {
    startBatch(
      this._dashboard,
      t('dashboard.edit-actions.remove-multiple', 'Remove {{typeName}} ({{num}})', {
        num: this._rows.length,
        typeName: this.getEditableElementInfo().typeName.toLowerCase(),
      })
    );

    this._rows.forEach((row) => row.onDelete());

    endBatch(this._dashboard);
  }

  public onHeaderHiddenToggle(value: boolean, indeterminate: boolean) {
    this._rows.forEach((row) => row.onHeaderHiddenToggle(indeterminate ? true : !value));
  }
}
