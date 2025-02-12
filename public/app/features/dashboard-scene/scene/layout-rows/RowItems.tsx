import { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from '../types/MultiSelectedEditableDashboardElement';

import { RowItem } from './RowItem';
import { getEditOptions, renderActions } from './RowItemsEditor';

export class RowItems implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Rows';
  public readonly key: string;

  public constructor(private _rows: RowItem[]) {
    this.key = uuidv4();
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
