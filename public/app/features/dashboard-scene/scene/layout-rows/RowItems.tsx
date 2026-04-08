import { t } from '@grafana/i18n';
import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { type EditableDashboardElementInfo, type EditableDashboardElement } from '../types/EditableDashboardElement';

import { type RowItem } from './RowItem';
import { getEditOptions } from './RowItemsEditor';

export class RowItems implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private _rows: RowItem[]) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeName: t('dashboard.edit-pane.elements.rows', 'Rows'), icon: 'folder', instanceName: '' };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public getRows(): RowItem[] {
    return this._rows;
  }

  public onDelete() {
    this._rows.forEach((row) => row.onDelete());
  }

  public onHeaderHiddenToggle(value: boolean, indeterminate: boolean) {
    this._rows.forEach((row) => row.onHeaderHiddenToggle(indeterminate ? true : !value));
  }
}
