import { SceneObjectState, VizPanel, SceneObjectBase } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;

  public readonly isDashboardLayoutItem = true;

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }
}
