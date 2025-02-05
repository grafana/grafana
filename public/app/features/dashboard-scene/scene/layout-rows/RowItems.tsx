import { ReactNode } from 'react';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from '../types/MultiSelectedEditableDashboardElement';

import { RowItem } from './RowItem';
import { getEditOptions, renderActions } from './RowItemsEditor';

export class RowItems implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly typeName = 'Rows';

  public constructor(private _rows: RowItem[]) {}

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
}
