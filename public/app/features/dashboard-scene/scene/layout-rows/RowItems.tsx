import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../types/MultiSelectedEditableDashboardElement';

import { RowItem } from './RowItem';
import { getEditOptions, renderActions } from './RowItemsEditor';

export class RowItems implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly key: string;

  public constructor(private _rows: RowItem[]) {
    this.key = uuidv4();
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { name: t('dashboard.edit-pane.elements.rows', 'Rows'), typeId: 'rows', icon: 'folder' };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public renderActions(): ReactNode {
    return renderActions(this);
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
